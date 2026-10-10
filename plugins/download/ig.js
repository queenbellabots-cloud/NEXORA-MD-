/**
 * NEXORA MD - Instagram Downloader
 * Library: instagram-url-direct
 * Usage: .ig <instagram-url>
 */
const settings = require('../../settings');
const instagramGetUrl = require('instagram-url-direct');

module.exports = {
  name: 'ig',
  aliases: ['insta', 'instagram'],
  category: 'download',
  description: 'Download Instagram reels/posts',
  usage: '.ig <url>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      let url = args.join(' ').trim();
      if (!url) {
        const q = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (q) {
          const txt = q.conversation || q.extendedTextMessage?.text || '';
          url = txt.split(/\s+/).find(x => x.includes('instagram.com'));
        }
      }
      if (!url || !url.includes('instagram.com')) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return conn.sendMessage(chatId, { text: `Usage: ${settings.prefix || '.'}ig <instagram-url>\n\n${settings.footer}` });
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Downloading Instagram...` });

      const result = await instagramGetUrl(url);
      const links = result?.url_list || [];
      if (!links.length) throw new Error('No media found');

      for (const link of links) {
        try {
          await conn.sendMessage(chatId, {
            video: { url: link },
            caption: `INSTAGRAM\n\n${settings.footer}`,
            mimetype: 'video/mp4',
            fileName: `ig_${Date.now()}.mp4`
          }, { quoted: mek });
        } catch (e) {
          await conn.sendMessage(chatId, { video: { url: link }, caption: settings.footer }, { quoted: mek });
        }
      }
    } catch (error) {
      console.log('[IG] Error:', error.message);
      await conn.sendMessage(chatId, { text: `Instagram failed: ${error.message}\n\n${settings.footer}` });
    }
  }
};