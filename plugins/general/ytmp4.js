/**
 * NEXORA MD - YouTube MP4 Downloader
 * Uses youtubemp4.to scraper (no API key)
 * Usage:
 *   .ytmp4 <url>            → show available formats
 *   .ytmp4 720 <url>        → download that resolution
 *   .ytmp4 1080 <url>       → download 1080p
 *   .ytmp4 480 <url>        → download 480p
 *   .ytmp4 audio <url>      → download best audio
 */

const settings = require('../../settings');
const axios = require('axios');
const qs = require('qs');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://youtubemp4.to';
const TMP_DIR = './data/tmp';
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: `${BASE_URL}/HAOT/`,
  Origin: BASE_URL
};

// ─────────────────────────────────────────────
// FETCH COOKIES
// ─────────────────────────────────────────────
async function fetchCookies() {
  try {
    const res = await axios.head(`${BASE_URL}/HAOT/`, {
      headers: HEADERS,
      timeout: 15000
    });
    return res.headers['set-cookie'] ? res.headers['set-cookie'].join('; ') : '';
  } catch (e) {
    return '';
  }
}

// ─────────────────────────────────────────────
// SCRAPE AVAILABLE FORMATS
// ─────────────────────────────────────────────
async function scrapeFormats(url) {
  const cookies = await fetchCookies();

  const headers = {
    ...HEADERS,
    Cookie: cookies,
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest'
  };

  const { data } = await axios.post(
    `${BASE_URL}/download_ajax/`,
    qs.stringify({ url }),
    { headers, timeout: 30000 }
  );

  const html = data?.result || '';
  const $ = cheerio.load(html);

  const title = $('.meta h2').text().trim() || 'Unknown';
  const thumbnail = $('.poster img').attr('src') || '';

  const allFormats = [];

  $('.results-other table tbody tr').each((_, el) => {
    const qualityText = $(el).find('td').eq(0).text().trim();
    const sizeText = $(el).find('td').eq(1).text().trim();
    const linkUrl = $(el).find('td a').attr('href') || '';

    if (linkUrl) {
      allFormats.push({
        quality: qualityText,
        size: sizeText,
        link: linkUrl
      });
    }
  });

  const audioFormats = allFormats.filter(f => /audio|mp3|kbps|kbit/i.test(f.quality));
  const bestAudio = audioFormats.length > 0 ? audioFormats[0] : null;

  const filteredVideos = allFormats.filter(f => {
    const isAudio = /audio|mp3|kbps|kbit/i.test(f.quality);
    if (isAudio) return false;

    const match = f.quality.match(/\d+/);
    if (match) {
      const resValue = match[0];
      return ['360', '480', '720', '1080', '1440'].includes(resValue);
    }
    return false;
  });

  return {
    title,
    thumbnail,
    all: allFormats,
    audio: bestAudio,
    video: filteredVideos
  };
}

// ─────────────────────────────────────────────
// DOWNLOAD MEDIA AS BUFFER
// ─────────────────────────────────────────────
async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxRedirects: 5,
    headers: {
      'User-Agent': HEADERS['User-Agent'],
      Accept: '*/*'
    }
  });
  return Buffer.from(res.data);
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'ytmp4',
  aliases: ['ytmp4to', 'y4to', 'ytv'],
  category: 'general',
  description: 'Download YouTube video via youtubemp4.to',
  usage: '.ytmp4 [480|720|1080|audio] <url>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      // ─────────────────────────────────────────
      // 1. Parse quality + URL
      // ─────────────────────────────────────────
      let quality = null;
      let url = '';

      if (args.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `YouTube Video Downloader\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}ytmp4 <url>            - list formats\n` +
            `  ${settings.prefix || '.'}ytmp4 480 <url>        - download 480p\n` +
            `  ${settings.prefix || '.'}ytmp4 720 <url>        - download 720p\n` +
            `  ${settings.prefix || '.'}ytmp4 1080 <url>       - download 1080p\n` +
            `  ${settings.prefix || '.'}ytmp4 audio <url>      - best audio\n\n` +
            `Example:\n` +
            `  ${settings.prefix || '.'}ytmp4 720 https://youtu.be/xxxxx\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const first = args[0].toLowerCase();
      if (['480', '720', '1080', '360', '1440', 'audio', 'mp3'].includes(first)) {
        quality = first;
        url = args.slice(1).join(' ').trim();
      } else {
        url = args.join(' ').trim();
      }

      if (!url || !/https?:\/\//.test(url)) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Valid YouTube URL required.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 2. Scrape
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Fetching formats...` });

      let result = null;
      try {
        result = await scrapeFormats(url);
      } catch (e) {
        console.log('[YTMP4] Scrape failed:', e.message);
      }

      if (!result || (!result.audio && result.video.length === 0)) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Could not fetch video formats.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 3. No quality specified → list formats
      // ─────────────────────────────────────────
      if (!quality) {
        let text = `YOUTUBE DOWNLOADER\n\n`;
        text += `Title: ${result.title.slice(0, 60)}\n\n`;

        text += `VIDEO FORMATS:\n`;
        if (result.video.length === 0) {
          text += `  (none available)\n`;
        } else {
          result.video.forEach(v => {
            text += `  ${v.quality} — ${v.size}\n`;
          });
        }

        text += `\nAUDIO:\n`;
        if (result.audio) {
          text += `  ${result.audio.quality} — ${result.audio.size}\n`;
        } else {
          text += `  (none available)\n`;
        }

        text += `\nUsage:\n`;
        text += `  ${settings.prefix || '.'}ytmp4 720 <url>\n`;
        text += `  ${settings.prefix || '.'}ytmp4 audio <url>\n\n`;
        text += `${settings.footer}`;

        await conn.sendMessage(chatId, { text });
        return;
      }

      // ─────────────────────────────────────────
      // 4. Find format
      // ─────────────────────────────────────────
      let chosen = null;

      if (quality === 'audio' || quality === 'mp3') {
        chosen = result.audio;
      } else {
        chosen = result.video.find(v => v.quality.includes(quality));
      }

      if (!chosen) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Format ${quality} not available.\n\n${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, {
        text: `Downloading ${chosen.quality} (${chosen.size})...`
      });

      // ─────────────────────────────────────────
      // 5. Download + send
      // ─────────────────────────────────────────
      let buffer = null;
      try {
        buffer = await downloadBuffer(chosen.link);
      } catch (e) {
        console.log('[YTMP4] Download failed:', e.message);
      }

      if (!buffer || buffer.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Download failed.\n\n${settings.footer}`
        });
        return;
      }

      const safeTitle = (result.title || 'video').slice(0, 60).replace(/[\\/:*?"<>|]/g, '');
      const isAudio = quality === 'audio' || quality === 'mp3';

      try {
        if (isAudio) {
          await conn.sendMessage(chatId, {
            audio: buffer,
            mimetype: 'audio/mpeg',
            ptt: false,
            fileName: `${safeTitle}.mp3`
          }, { quoted: mek });
        } else {
          await conn.sendMessage(chatId, {
            video: buffer,
            mimetype: 'video/mp4',
            caption: `*${result.title}*\n\nQuality: ${chosen.quality}\nSize: ${chosen.size}\n\n${settings.footer}`
          }, { quoted: mek });
        }

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        console.log('[YTMP4] Sent:', chosen.quality, '-', buffer.length, 'bytes');
      } catch (sendErr) {
        console.log('[YTMP4] Send failed:', sendErr.message);
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Failed to send media.\n\n` +
            `Reason: ${sendErr.message}\n\n` +
            `File may exceed WhatsApp's size limit.\n\n` +
            `${settings.footer}`
        });
      }

    } catch (error) {
      console.log('[YTMP4] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};