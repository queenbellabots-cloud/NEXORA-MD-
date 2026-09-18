/**
 * NEXORA MD - YouTube Downloader
 * Downloads video or audio from YouTube
 * Uses multiple public APIs with fallback
 * Usage:
 *   .yt <url>              → video (default)
 *   .yt mp3 <url>          → audio (MP3)
 *   .yt mp4 <url>          → video (MP4)
 */

const settings = require('../../settings');
const axios = require('axios');

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function isYouTubeUrl(url) {
  if (!url) return false;
  return /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)/i.test(url);
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

// ─────────────────────────────────────────────
// API: cobalt.tools — most reliable fallback
// ─────────────────────────────────────────────
async function cobaltDownload(url, isAudio) {
  const endpoints = [
    'https://api.cobalt.tools/api/json',
    'https://co.wuk.sh/api/json'
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await axios.post(endpoint, {
        url,
        isAudioOnly: isAudio,
        aFormat: 'mp3',
        vQuality: '720',
        filenamePattern: 'basic'
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 40000
      });

      if (res.data && res.data.url) {
        return {
          url: res.data.url,
          title: res.data.filename || 'YouTube Media'
        };
      }
    } catch (e) {
      console.log('[YT] cobalt failed:', endpoint, '-', e.message);
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// API: azbry fallback
// ─────────────────────────────────────────────
async function azbryDownload(url, isAudio) {
  try {
    const type = isAudio ? 'ytmp3' : 'ytmp4';
    const apiUrl = `https://api.azbry.com/api/download/${type}?url=${encodeURIComponent(url)}`;
    const res = await axios.get(apiUrl, { timeout: 30000 });

    if (res.data?.status && res.data?.result) {
      const r = res.data.result;
      const downloadUrl = r.download || r.url || r.video || r.mp4 || r.audio;
      if (downloadUrl) {
        return {
          url: downloadUrl,
          title: r.title || 'YouTube Media'
        };
      }
    }
  } catch (e) {
    console.log('[YT] azbry failed:', e.message);
  }
  return null;
}

// ─────────────────────────────────────────────
// API: y2mate-style fallback
// ─────────────────────────────────────────────
async function y2mateDownload(url, isAudio) {
  try {
    const apiUrl = isAudio
      ? `https://api.azbry.com/api/download/ytdl?url=${encodeURIComponent(url)}&type=audio`
      : `https://api.azbry.com/api/download/ytdl?url=${encodeURIComponent(url)}&type=video`;
    const res = await axios.get(apiUrl, { timeout: 30000 });

    if (res.data?.status && res.data?.result) {
      const r = res.data.result;
      const downloadUrl = r.download || r.url || r.video || r.mp4;
      if (downloadUrl) {
        return {
          url: downloadUrl,
          title: r.title || 'YouTube Media'
        };
      }
    }
  } catch (e) {
    console.log('[YT] ytdl fallback failed:', e.message);
  }
  return null;
}

// ─────────────────────────────────────────────
// MASTER: try APIs in order
// ─────────────────────────────────────────────
async function fetchDownload(url, isAudio) {
  // Try cobalt first (most reliable)
  let result = await cobaltDownload(url, isAudio);
  if (result) return result;

  // Then azbry
  result = await azbryDownload(url, isAudio);
  if (result) return result;

  // Then ytdl
  result = await y2mateDownload(url, isAudio);
  if (result) return result;

  return null;
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'yt',
  aliases: ['youtube', 'ytdl', 'ytv'],
  category: 'general',
  description: 'Download YouTube video or audio',
  usage: '.yt [mp3|mp4] <url>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      // ─────────────────────────────────────────
      // 1. Parse mode + URL
      // ─────────────────────────────────────────
      let mode = 'video';
      let url = '';

      if (args.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `YouTube Downloader\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}yt <url>        - video\n` +
            `  ${settings.prefix || '.'}yt mp3 <url>    - audio only\n` +
            `  ${settings.prefix || '.'}yt mp4 <url>    - video MP4\n\n` +
            `Examples:\n` +
            `  ${settings.prefix || '.'}yt https://youtu.be/xxxxx\n` +
            `  ${settings.prefix || '.'}yt mp3 https://youtube.com/watch?v=xxxxx\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const first = args[0].toLowerCase();
      if (['mp3', 'audio', 'music'].includes(first)) {
        mode = 'audio';
        url = args.slice(1).join(' ').trim();
      } else if (['mp4', 'video'].includes(first)) {
        mode = 'video';
        url = args.slice(1).join(' ').trim();
      } else {
        url = args.join(' ').trim();
      }

      if (!url) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, { text: `YouTube URL required.\n\n${settings.footer}` });
        return;
      }

      if (!isYouTubeUrl(url)) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, { text: `Not a valid YouTube URL.\n\n${settings.footer}` });
        return;
      }

      // ─────────────────────────────────────────
      // 2. React
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `Fetching ${mode === 'audio' ? 'audio' : 'video'}...`
      });

      // ─────────────────────────────────────────
      // 3. Fetch download link
      // ─────────────────────────────────────────
      const isAudio = mode === 'audio';
      const result = await fetchDownload(url, isAudio);

      if (!result || !result.url) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Could not fetch download link.\n\n` +
            `Downloader APIs may be down. Try again in a moment.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const displayTitle = result.title || 'YouTube Media';
      const safeTitle = displayTitle.slice(0, 60).replace(/[\\/:*?"<>|]/g, '') || 'media';

      await conn.sendMessage(chatId, {
        text: `Downloading: ${displayTitle}\n\nPlease wait...`
      });

      // ─────────────────────────────────────────
      // 4. Send media
      // ─────────────────────────────────────────
      try {
        if (isAudio) {
          await conn.sendMessage(chatId, {
            audio: { url: result.url },
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: `${safeTitle}.mp3`
          }, { quoted: mek });
        } else {
          await conn.sendMessage(chatId, {
            video: { url: result.url },
            mimetype: 'video/mp4',
            caption: `*${displayTitle}*\n\n${settings.footer}`
          }, { quoted: mek });
        }

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        console.log('[YT] Sent', mode, ':', displayTitle);

      } catch (sendErr) {
        console.log('[YT] Send failed:', sendErr.message);
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Failed to send media.\n\n` +
            `Reason: ${sendErr.message}\n\n` +
            `File may be too large for WhatsApp (max ~16 MB).\n\n` +
            `${settings.footer}`
        });
      }

    } catch (error) {
      console.log('[YT] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};