/**
 * NEXORA MD - TikTok Downloader
 * API: Omegatech
 * Usage:
 *   .td <tiktok-url>
 *   .td (reply to a tiktok link)
 */

const settings = require('../../settings');
const axios = require('axios');

const API_BASE = 'https://api.omegatech.xyz';

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
      // 3. Try Omegatech TikTok API (POST then GET)
      // ─────────────────────────────────────────
      let data = null;
      let lastError = null;

      // Try POST
      try {
        console.log('[TD] Trying: Omegatech POST');
        const res = await axios.post(`${API_BASE}/download/tiktok`, { url }, {
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          timeout: 45000
        });
        data = res.data;
        console.log('[TD] POST response:', JSON.stringify(data).slice(0, 500));
      } catch (e) {
        lastError = e.message;
        console.log('[TD] Omegatech POST failed:', e.message);
      }

      // Try GET fallback
      if (!data) {
        try {
          console.log('[TD] Trying: Omegatech GET');
          const res = await axios.get(`${API_BASE}/download/tiktok`, {
            params: { url, action: 'download' },
            timeout: 45000
          });
          data = res.data;
          console.log('[TD] GET response:', JSON.stringify(data).slice(0, 500));
        } catch (e) {
          lastError = e.message;
          console.log('[TD] Omegatech GET failed:', e.message);
        }
      }

      // Try alternate endpoint if still nothing
      if (!data) {
        try {
          console.log('[TD] Trying: alternate endpoint');
          const res = await axios.get(
            `https://apis.davidcyril.name.ng/download/tiktokdl3?url=${encodeURIComponent(url)}`,
            { timeout: 45000, headers: { 'Accept': 'application/json' } }
          );
          data = res.data;
          console.log('[TD] Alternate response:', JSON.stringify(data).slice(0, 500));
        } catch (e) {
          lastError = e.message;
          console.log('[TD] Alternate failed:', e.message);
        }
      }

      if (!data) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `TikTok download failed.\n\nReason: ${lastError || 'No response'}\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 4. Extract video URL (handles all common shapes)
      // ─────────────────────────────────────────
      const payload = data?.result || data?.data || data;

      const videoUrl =
        payload?.video ||
        payload?.videoUrl ||
        payload?.no_watermark ||
        payload?.noWatermark ||
        payload?.play ||
        payload?.hd ||
        payload?.hdplay ||
        payload?.download_url ||
        payload?.downloadUrl ||
        payload?.url ||
        (Array.isArray(payload?.videos) && payload.videos[0]?.url) ||
        (Array.isArray(payload?.links) && payload.links[0]) ||
        null;

      const musicUrl =
        payload?.music ||
        payload?.audio ||
        payload?.musicUrl ||
        payload?.audioUrl ||
        null;

      const title = payload?.title || payload?.desc || 'TikTok Video';
      const author =
        payload?.author?.nickname ||
        payload?.author?.unique_id ||
        payload?.author ||
        payload?.username ||
        'Unknown';

      if (!videoUrl || typeof videoUrl !== 'string') {
        const preview = JSON.stringify(data).slice(0, 600);
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `No video URL found in API response.\n\nAPI said:\n\`\`\`\n${preview}\n\`\`\`\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 5. Send video
      // ─────────────────────────────────────────
      const caption =
        `TIKTOK\n\n` +
        `Title: ${title}\n` +
        `Author: ${author}\n\n` +
        `${settings.footer}`;

      try {
        await conn.sendMessage(chatId, {
          video: { url: videoUrl },
          caption,
          mimetype: 'video/mp4',
          fileName: `tiktok_${Date.now()}.mp4`
        }, { quoted: mek });

        console.log(`[TD] Video sent: ${title}`);

        // Optional: send audio
        if (musicUrl) {
          try {
            await conn.sendMessage(chatId, {
              audio: { url: musicUrl },
              mimetype: 'audio/mp4',
              fileName: `tiktok_audio_${Date.now()}.mp3`,
              ptt: false
            }, { quoted: mek });
          } catch (audioErr) {
            console.log('[TD] Audio failed:', audioErr.message);
          }
        }
      } catch (sendErr) {
        console.log('[TD] Send failed:', sendErr.message);
        await conn.sendMessage(chatId, {
          text: `Video send failed: ${sendErr.message}\n\nDirect link:\n${videoUrl}\n\n${settings.footer}`
        });
      }

    } catch (error) {
      console.log('[TD] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};