/**
 * NEXORA MD - YouTube Play / Download
 * Accepts either a song name OR a YouTube URL
 * Usage:
 *   .yt <song name>          → search + download audio
 *   .yt <youtube url>        → download that video's audio
 */

const settings = require('../../settings');
const axios = require('axios');

// ─────────────────────────────────────────────
// URL DETECTION
// ─────────────────────────────────────────────
function isYouTubeUrl(text) {
  return /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)/i.test(text);
}

function extractVideoId(url) {
  try {
    if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split(/[?&]/)[0];
    if (url.includes('v=')) return url.split('v=')[1].split(/[?&]/)[0];
    if (url.includes('/shorts/')) return url.split('/shorts/')[1].split(/[?&]/)[0];
    if (url.includes('/embed/')) return url.split('/embed/')[1].split(/[?&]/)[0];
  } catch (e) {}
  return null;
}

module.exports = {
  name: 'yt',
  aliases: ['playyt', 'ytplay', 'play', 'ytdl'],
  category: 'download',
  description: 'Download YouTube audio by name or URL',
  usage: '.yt <song name or URL>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const input = args.join(' ').trim();

      if (!input) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `YouTube Play\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}yt <song name>\n` +
            `  ${settings.prefix || '.'}yt <youtube url>\n\n` +
            `Examples:\n` +
            `  ${settings.prefix || '.'}yt Sauti Sol Suzanna\n` +
            `  ${settings.prefix || '.'}yt https://youtu.be/xxxxx\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const isUrl = isYouTubeUrl(input);
      const videoId = isUrl ? extractVideoId(input) : null;

      if (isUrl && !videoId) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Could not extract video ID from URL.\n\n${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: isUrl ? `Downloading from URL...` : `Searching YouTube for "${input}"...`
      });

      // ─────────────────────────────────────────
      // CHOOSE ENDPOINT BASED ON INPUT TYPE
      // ─────────────────────────────────────────
      let apiUrl;
      if (isUrl) {
        // Download by URL
        apiUrl = `https://api.azbry.com/api/download/ytmp3?url=${encodeURIComponent(input)}`;
      } else {
        // Search by name
        apiUrl = `https://api.azbry.com/api/download/ytplay2?q=${encodeURIComponent(input)}`;
      }

      console.log('[YT] Requesting:', apiUrl.split('?')[0]);

      let data = null;
      try {
        const res = await axios.get(apiUrl, {
          timeout: 60000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        data = res.data;
      } catch (apiErr) {
        console.log('[YT] API error:', apiErr.message);
      }

      // ─────────────────────────────────────────
      // PARSE RESPONSE (both endpoints have same shape)
      // ─────────────────────────────────────────
      let result = null;

      if (data && data.status && data.result) {
        result = data.result;
      } else if (data && data.result) {
        result = data.result;
      } else if (data && data.data) {
        result = data.data;
      }

      // Normalize URL field
      if (result && !result.download) {
        result.download = result.url || result.mp3 || result.audio || result.link;
      }

      if (!result || !result.download) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Could not fetch audio.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // SEND THUMBNAIL + INFO
      // ─────────────────────────────────────────
      const title = result.title || input;
      const channel = result.channel || 'Unknown';

      const caption =
        `YOUTUBE PLAY\n\n` +
        `Title: ${title}\n` +
        `Channel: ${channel}\n` +
        (result.url ? `URL: ${result.url}\n` : '') +
        `\nSending audio...\n\n` +
        `${settings.footer}`;

      if (result.thumbnail) {
        try {
          await conn.sendMessage(chatId, {
            image: { url: result.thumbnail },
            caption
          }, { quoted: mek });
        } catch (thumbErr) {
          console.log('[YT] Thumbnail failed:', thumbErr.message);
        }
      }

      // ─────────────────────────────────────────
      // SEND AUDIO
      // ─────────────────────────────────────────
      const safeTitle = String(title).slice(0, 60).replace(/[\\/:*?"<>|]/g, '');

      try {
        await conn.sendMessage(chatId, {
          audio: { url: result.download },
          mimetype: 'audio/mpeg',
          fileName: `${safeTitle}.mp3`,
          ptt: false
        }, { quoted: mek });

        console.log('[YT] Sent audio:', safeTitle, isUrl ? '(URL)' : '(search)');
      } catch (audioErr) {
        console.log('[YT] Audio send failed:', audioErr.message);
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Failed to send audio: ${audioErr.message}\n\n${settings.footer}`
        });
      }

    } catch (error) {
      console.log('[YT] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}

      let errorMessage = error.message || 'Unknown error';
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        errorMessage = 'Request timed out. Try again.';
      }

      await conn.sendMessage(chatId, {
        text: `YouTube Play failed.\n\n${errorMessage}\n\n${settings.footer}`
      });
    }
  }
};