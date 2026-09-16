/**
 * NEXORA MD - Play (YouTube Audio)
 * Search YouTube and send the top result as audio
 * Usage:
 *   .play <song name>
 *   .play <youtube url>
 */

const settings = require('../../settings');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

const TMP_DIR = './data/tmp';
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ─────────────────────────────────────────────
// SEARCH YOUTUBE (no API key — uses Piped/Invidious style)
// ─────────────────────────────────────────────
async function searchYouTube(query) {
  // Primary: Piped API
  const endpoints = [
    `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=music_songs`,
    `https://api.piped.yt/search?q=${encodeURIComponent(query)}&filter=videos`,
    `https://pipedapi.adminforge.de/search?q=${encodeURIComponent(query)}&filter=videos`
  ];

  for (const url of endpoints) {
    try {
      const res = await axios.get(url, { timeout: 15000 });
      const items = res.data?.items || res.data || [];
      const video = items.find(i => i.url && i.url.includes('watch?v=') && i.duration > 0);
      if (video) {
        return {
          title: video.title,
          videoId: video.url.split('v=')[1]?.split('&')[0],
          duration: video.duration,
          uploader: video.uploaderName || video.uploader || '',
          thumbnail: video.thumbnail
        };
      }
    } catch (e) {
      console.log('[PLAY] Search endpoint failed:', url.split('/')[2], e.message);
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// EXTRACT AUDIO (via yt-dlp if available, else cobalt.tools API)
// ─────────────────────────────────────────────
async function getAudioUrl(videoId) {
  // Primary: cobalt.tools public API
  const cobaltEndpoints = [
    'https://api.cobalt.tools/api/json',
    'https://co.wuk.sh/api/json'
  ];

  for (const endpoint of cobaltEndpoints) {
    try {
      const res = await axios.post(endpoint, {
        url: `https://www.youtube.com/watch?v=${videoId}`,
        isAudioOnly: true,
        aFormat: 'mp3'
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 20000
      });

      if (res.data && res.data.url) {
        return res.data.url;
      }
    } catch (e) {
      console.log('[PLAY] Cobalt failed:', endpoint, e.message);
    }
  }

  return null;
}

// ─────────────────────────────────────────────
// DOWNLOAD + SEND
// ─────────────────────────────────────────────
async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  return Buffer.from(res.data);
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'play',
  aliases: ['song', 'music', 'audio'],
  category: 'general',
  description: 'Search and play a song from YouTube',
  usage: '.play <song name or URL>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const query = args.join(' ').trim();
      if (!query) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Play a song from YouTube\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}play <song name>\n` +
            `  ${settings.prefix || '.'}play <youtube url>\n\n` +
            `Example:\n` +
            `  ${settings.prefix || '.'}play Sauti Sol Suzanna\n\n` +
            `${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '⏳', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Searching for "${query}"...` });

      // ─────────────────────────────────────────
      // Extract video ID if URL
      // ─────────────────────────────────────────
      let videoInfo = null;

      if (query.includes('youtube.com/watch') || query.includes('youtu.be/')) {
        const videoId = query.includes('v=')
          ? query.split('v=')[1].split('&')[0]
          : query.split('youtu.be/')[1].split('?')[0];

        videoInfo = {
          title: 'YouTube Video',
          videoId,
          duration: 0,
          uploader: ''
        };
      } else {
        videoInfo = await searchYouTube(query);
      }

      if (!videoInfo || !videoInfo.videoId) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `No results found for "${query}".\n\n${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, {
        text:
          `Found: ${videoInfo.title}\n` +
          (videoInfo.uploader ? `Channel: ${videoInfo.uploader}\n` : '') +
          (videoInfo.duration ? `Duration: ${formatDuration(videoInfo.duration)}\n` : '') +
          `\nDownloading audio...`
      });

      // ─────────────────────────────────────────
      // Get audio URL
      // ─────────────────────────────────────────
      const audioUrl = await getAudioUrl(videoInfo.videoId);

      if (!audioUrl) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Could not extract audio.\n\n` +
            `The downloader API may be down. Try again in a moment.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // Download buffer
      // ─────────────────────────────────────────
      let buffer = null;
      try {
        buffer = await downloadBuffer(audioUrl);
      } catch (dlErr) {
        console.log('[PLAY] Download failed:', dlErr.message);
      }

      if (!buffer || buffer.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Download failed. Try again.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // Send as audio
      // ─────────────────────────────────────────
      const duration = videoInfo.duration || 0;

      await conn.sendMessage(chatId, {
        audio: buffer,
        mimetype: 'audio/mpeg',
        ptt: false,
        fileName: `${videoInfo.title}.mp3`
      }, { quoted: mek });

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

    } catch (error) {
      console.log('[PLAY] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};