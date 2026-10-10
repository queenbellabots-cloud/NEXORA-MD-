/**
 * NEXORA MD - TikTok Downloader
 * Library: @ssut/tiktok-api (direct TikTok endpoints, no public API)
 * Usage:
 *   .td <tiktok-url>
 *   .td (reply to a tiktok link)
 */

const settings = require('../../settings');

// Load the library safely so plugin never crashes on load
let TikTokClient;
try {
  ({ TikTokClient } = require('@ssut/tiktok-api'));
} catch (e) {
  console.log('[TD] Library not installed:', e.message);
  TikTokClient = null;
}

module.exports = {
  name: 'td',
  aliases: ['tiktok', 'tt', 'tikdl'],
  category: 'download',
  description: 'Download TikTok video without watermark',
  usage: '.td <tiktok-url>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      // ─── Library missing check ───
      if (!TikTokClient) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return conn.sendMessage(chatId, {
          text:
            `TikTok library is not installed.\n\n` +
            `Owner: run ${settings.prefix || '.'}restart to install dependencies.\n\n` +
            `${settings.footer}`
        });
      }

      // ─── Get URL ───
      let url = args.join(' ').trim();

      if (!url) {
        const ctx = mek.message?.extendedTextMessage?.contextInfo;
        const q = ctx?.quotedMessage;
        if (q) {
          const txt = q.conversation || q.extendedTextMessage?.text || '';
          const found = txt.split(/\s+/).find(x => x.includes('tiktok.com'));
          if (found) url = found;
        }
      }

      if (!url || !url.includes('tiktok.com')) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return conn.sendMessage(chatId, {
          text:
            `TikTok Downloader\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}td <tiktok-url>\n` +
            `  Reply to a message with ${settings.prefix || '.'}td\n\n` +
            `Examples:\n` +
            `  ${settings.prefix || '.'}td https://vt.tiktok.com/xxxxx/\n` +
            `  ${settings.prefix || '.'}td https://www.tiktok.com/@user/video/123\n\n` +
            `${settings.footer}`
        });
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Downloading TikTok...` });

      // ─── Download via library ───
      const client = new TikTokClient({ region: 'US' });
      console.log(`[TD] Fetching: ${url}`);

      const download = await client.downloadVideo(url);
      console.log('[TD] Status:', download.status, 'Type:', download.result?.type);

      if (download.status !== 'success' || download.result?.type !== 'video') {
        throw new Error(download.message || 'No video data returned');
      }

      const formats = download.result.video.formats || [];
      const best =
        formats.find(f => !f.has_watermark && (f.resolution || '').includes('1080')) ||
        formats.find(f => !f.has_watermark) ||
        formats[0];

      if (!best?.url) throw new Error('No downloadable format found');

      console.log(`[TD] ✅ ${best.resolution || 'best'} | watermark: ${best.has_watermark}`);

      // ─── Send video ───
      const caption =
        `TIKTOK\n\n` +
        `Title: ${download.result.desc || 'TikTok Video'}\n` +
        `Author: ${download.result.author?.uniqueId || 'Unknown'}\n\n` +
        `${settings.footer}`;

      await conn.sendMessage(chatId, {
        video: { url: best.url },
        caption,
        mimetype: 'video/mp4',
        fileName: `tiktok_${Date.now()}.mp4`
      }, { quoted: mek });

      console.log('[TD] Video sent');

    } catch (error) {
      console.log('[TD] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, {
        text: `TikTok download failed.\n\nReason: ${error.message}\n\n${settings.footer}`
      });
    }
  }
};