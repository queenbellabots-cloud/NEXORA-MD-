/**
 * NEXORA MD - Facebook Downloader
 * Library: @renpwn/fb-downloader
 * Usage: .fb <facebook-url>
 */
const settings = require('../../settings');
const getFBInfo = require('@renpwn/fb-downloader');

module.exports = {
  name: 'fb',
  aliases: ['facebook'],
  category: 'download',
  description: 'Download Facebook videos',
  usage: '.fb <url>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      let url = args.join(' ').trim();
      if (!url) {
        const q = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (q) {
          const txt = q.conversation || q.extendedTextMessage?.text || '';
          url = txt.split(/\s+/).find(x => x.includes('facebook.com') || x.includes('fb.watch'));
        }
      }

      if (!url || !(url.includes('facebook.com') || url.includes('fb.watch'))) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return conn.sendMessage(chatId, {
          text: `Usage: ${settings.prefix || '.'}fb <facebook-url>\n\n${settings.footer}`
        });
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Downloading Facebook...` });

      const result = await getFBInfo(url);
      if (!result || (!result.hd && !result.sd)) {
        throw new Error('No video found');
      }

      const videoUrl = result.hd || result.sd;
      const caption =
        `FACEBOOK\n\n` +
        `Title: ${result.title || 'Video'}\n\n` +
        `${settings.footer}`;

      await conn.sendMessage(chatId, {
        video: { url: videoUrl },
        caption,
        mimetype: 'video/mp4',
        fileName: `fb_${Date.now()}.mp4`
      }, { quoted: mek });

    } catch (error) {
      console.log('[FB] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, {
        text: `Facebook failed: ${error.message}\n\n${settings.footer}`
      });
    }
  }
};