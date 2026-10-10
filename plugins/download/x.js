/**
 * NEXORA MD - Twitter/X Downloader
 * Library: twitter-downloader
 * Usage: .x <twitter-url>
 */
const settings = require('../../settings');
const { TwitterDL } = require('twitter-downloader');

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

      if (!url || !(url.includes('twitter.com') || url.includes('x.com'))) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return conn.sendMessage(chatId, {
          text: `Usage: ${settings.prefix || '.'}x <twitter-url>\n\n${settings.footer}`
        });
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Downloading Twitter/X...` });

      const result = await TwitterDL(url);
      if (result.status !== 'success' || !result.result?.media?.length) {
        throw new Error(result.message || 'No media found');
      }

      const media = result.result.media.find(m => m.type === 'video' || m.type === 'gif');
      if (!media) throw new Error('No video found in tweet');

      // twitter-downloader returns videos sorted; pick first (best quality)
      const best = media.videos?.[0];
      if (!best?.url) throw new Error('No downloadable video URL');

      const caption =
        `TWITTER/X\n\n` +
        `Author: @${result.result.author?.username || 'unknown'}\n` +
        `Text: ${(result.result.description || '').slice(0, 200) || 'No text'}\n\n` +
        `${settings.footer}`;

      await conn.sendMessage(chatId, {
        video: { url: best.url },
        caption,
        mimetype: 'video/mp4',
        fileName: `tw_${Date.now()}.mp4`
      }, { quoted: mek });
    } catch (error) {
      console.log('[X] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, {
        text: `Twitter/X failed: ${error.message}\n\n${settings.footer}`
      });
    }
  }
};