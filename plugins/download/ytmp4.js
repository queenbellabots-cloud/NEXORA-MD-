/**
 * NEXORA MD - YouTube MP4 Downloader
 * Library: @distube/ytdl-core
 * Usage: .ytmp4 <youtube-url>
 */
const settings = require('../../settings');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'ytmp4',
  aliases: ['ytvideo', 'ytv'],
  category: 'download',
  description: 'Download YouTube video as MP4',
  usage: '.ytmp4 <url>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    let tmpFile = null;
    try {
      let url = args.join(' ').trim();
      if (!url) {
        const q = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (q) {
          const txt = q.conversation || q.extendedTextMessage?.text || '';
          url = txt.split(/\s+/).find(x => x.includes('youtube.com') || x.includes('youtu.be'));
        }
      }
      if (!url) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return conn.sendMessage(chatId, { text: `Usage: ${settings.prefix || '.'}ytmp4 <youtube-url>\n\n${settings.footer}` });
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Downloading YouTube...` });

      const info = await ytdl.getInfo(url);
      const format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'audioandvideo' });

      tmpFile = path.join('./data/tmp', `yt_${Date.now()}.mp4`);
      const stream = ytdl(url, { format });
      await new Promise((resolve, reject) => {
        const write = fs.createWriteStream(tmpFile);
        stream.pipe(write);
        write.on('finish', resolve);
        write.on('error', reject);
      });

      const buffer = fs.readFileSync(tmpFile);
      const caption = `YOUTUBE\n\nTitle: ${info.videoDetails.title}\nAuthor: ${info.videoDetails.author.name}\n\n${settings.footer}`;

      await conn.sendMessage(chatId, {
        video: buffer,
        caption,
        mimetype: 'video/mp4',
        fileName: `${info.videoDetails.title.slice(0, 40)}.mp4`
      }, { quoted: mek });
    } catch (error) {
      console.log('[YTMP4] Error:', error.message);
      await conn.sendMessage(chatId, { text: `YouTube failed: ${error.message}\n\n${settings.footer}` });
    } finally {
      try { if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch (e) {}
    }
  }
};