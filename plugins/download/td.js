/**
 * NEXORA MD - TikTok Downloader
 * Primary: tikwm.com (reliable, no key)
 * Fallback: tiktokdl3
 * Usage:
 *   .td <tiktok-url>
 *   .td (reply to a tiktok link)
 */

const settings = require('../../settings');
const axios = require('axios');

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

      let videoUrl = null;
      let musicUrl = null;
      let title = 'TikTok Video';
      let author = 'Unknown';

      // ─────────────────────────────────────────
      // 3. PRIMARY: tikwm.com
      // ─────────────────────────────────────────
      try {
        console.log('[TD] Trying: tikwm.com');
        const res = await axios.get(
          `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`,
          { timeout: 30000, headers: { 'Accept': 'application/json' } }
        );

        const data = res.data;
        console.log('[TD] tikwm response:', JSON.stringify(data).slice(0, 500));

        if (data?.code === 0 && data.data) {
          const d = data.data;
          videoUrl = d.hdplay || d.play;
          musicUrl = d.music;
          title = d.title || title;
          author = d.author?.nickname || d.author?.unique_id || author;
        }
      } catch (e) {
        console.log('[TD] ❌ tikwm failed:', e.message);
      }

      // ─────────────────────────────────────────
      // 4. FALLBACK: tiktokdl3 (the one you gave)
      // ─────────────────────────────────────────
      if (!videoUrl) {
        try {
          console.log('[TD] Fallback: tiktokdl3');
          const res = await axios.get(
            `https://apis.davidcyril.name.ng/download/tiktokdl3?url=${encodeURIComponent(url)}`,
            { timeout: 45000, headers: { 'Accept': 'application/json' } }
          );

          const data = res.data;
          console.log('[TD] tiktokdl3 response:', JSON.stringify(data).slice(0, 500));

          const p = data?.result || data?.data || data;
          videoUrl = p?.video || p?.videoUrl || p?.no_watermark || p?.play || p?.hd;
          musicUrl = p?.music || p?.audio || null;
          title = p?.title || p?.desc || title;
          author = p?.author?.nickname || p?.author?.unique_id || p?.author || author;
        } catch (e) {
          console.log('[TD] ❌ tiktokdl3 failed:', e.message);
        }
      }

      // ─────────────────────────────────────────
      // 5. All failed
      // ─────────────────────────────────────────
      if (!videoUrl) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `TikTok download failed.\n\nBoth providers returned no video URL.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 6. Send video
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