/**
 * NEXORA MD - TikTok Downloader
 * Library: @ssut/tiktok-api (no public API, works from any host)
 * Usage:
 *   .td <tiktok-url>
 *   .td (reply to a tiktok link)
 */

const settings = require('../../settings');
const { TikTokClient } = require('@ssut/tiktok-api');

module.exports = {
  name: 'td',
  aliases: ['tiktok', 'tt', 'tikdl'],
  category: 'download',
  description: 'Download TikTok video without watermark',
  usage: '.td <tiktok-url>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      // ─────────────────────────────────────────
      // 1. Get URL from args or replied message
      // ─────────────────────────────────────────
      let url = args.join(' ').trim();

      if (!url) {
        const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
        const quoted = contextInfo?.quotedMessage;

        if (quoted) {
          const text =
            quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            '';
          const found = text.split(/\s+/).find(x => x.includes('tiktok.com'));
          if (found) url = found;
        }
      }

      if (!url || !url.includes('tiktok.com')) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
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
        return;
      }

      // ─────────────────────────────────────────
      // 2. React and notify
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Downloading TikTok...` });

      // ─────────────────────────────────────────
      // 3. Use local library (no public API)
      // ─────────────────────────────────────────
      const client = new TikTokClient({ region: 'US' });

      console.log(`[TD] Fetching: ${url}`);
      const download = await client.downloadVideo(url);

      if (download.status !== 'success' || download.result?.type !== 'video') {
        throw new Error(download.message || 'No video data returned');
      }

      const formats = download.result.video.formats || [];
      // Pick non-watermarked format, preferring HD
      const best =
        formats.find(f => !f.has_watermark && f.resolution?.includes('1080')) ||
        formats.find(f => !f.has_watermark) ||
        formats[0];

      if (!best?.url) throw new Error('No downloadable format found');

      const videoUrl = best.url;
      const title = download.result.desc || 'TikTok Video';
      const author = download.result.author?.uniqueId || 'Unknown';

      console.log(`[TD] ✅ Format: ${best.resolution || 'best'} | watermark: ${best.has_watermark}`);

      // ─────────────────────────────────────────
      // 4. Send the video
      // ─────────────────────────────────────────
      const caption =
        `TIKTOK\n\n` +
        `Title: ${title}\n` +
        `Author: ${author}\n\n` +
        `${settings.footer}`;

      await conn.sendMessage(chatId, {
        video: { url: videoUrl },
        caption,
        mimetype: 'video/mp4',
        fileName: `tiktok_${Date.now()}.mp4`
      }, { quoted: mek });

      console.log(`[TD] Video sent: ${title}`);

    } catch (error) {
      console.log('[TD] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `TikTok download failed.\n\nReason: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};