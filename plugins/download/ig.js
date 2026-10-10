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
        return conn.sendMessage(chatId, {
          text: `Usage: ${settings.prefix || '.'}ig <instagram-url>\n\n${settings.footer}`
        });
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Downloading Instagram...` });

      const result = await instagramGetUrl(url);
      const links = result?.url_list || [];
      if (links.length === 0) {
        throw new Error('No media found');
      }

      for (let i = 0; i < links.length; i++) {
        try {
          await conn.sendMessage(chatId, {
            video: { url: links[i] },
            caption: `INSTAGRAM${links.length > 1 ? ` (${i + 1}/${links.length})` : ''}\n\n${settings.footer}`,
            mimetype: 'video/mp4',
            fileName: `ig_${Date.now()}_${i}.mp4`
          }, { quoted: i === 0 ? mek : undefined });
        } catch (e) {
          console.log(`[IG] Link ${i} failed:`, e.message);
        }
      }

    } catch (error) {
      console.log('[IG] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, {
        text: `Instagram failed: ${error.message}\n\n${settings.footer}`
      });
    }
  }
};