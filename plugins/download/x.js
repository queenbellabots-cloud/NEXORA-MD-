/**
 * NEXORA MD - Twitter/X Downloader
 * Library: twitter-url-direct
 * Usage: .x <twitter-url>
 */
const settings = require('../../settings');
const twitterGetUrl = require('twitter-url-direct');

module.exports = {
  name: 'x',
  aliases: ['twitter', 'tw'],
  category: 'download',
  description: 'Download Twitter/X videos',
  usage: '.x <url>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      let url = args.join(' ').trim();
      if (!url) {
        const q = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (q) {
          const txt = q.conversation || q.extendedTextMessage?.text || '';
          url = txt.split(/\s+/).find(x => x.includes('twitter.com') || x.includes('x.com'));
        }
      }
      if (!url) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return conn.sendMessage(chatId, { text: `Usage: ${settings.prefix || '.'}x <twitter-url>\n\n${settings.footer}` });
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Downloading Twitter/X...` });

      const result = await twitterGetUrl(url);
      if (!result?.download?.length) throw new Error('No video found');

      const best = result.download.find(d => d.quality?.includes('720') || d.quality?.includes('1080')) || result.download[0];
      const caption = `TWITTER/X\n\nTitle: ${result.title || 'Video'}\n\n${settings.footer}`;

      await conn.sendMessage(chatId, {
        video: { url: best.url },
        caption,
        mimetype: 'video/mp4',
        fileName: `tw_${Date.now()}.mp4`
      }, { quoted: mek });
    } catch (error) {
      console.log('[X] Error:', error.message);
      await conn.sendMessage(chatId, { text: `Twitter/X failed: ${error.message}\n\n${settings.footer}` });
    }
  }
};