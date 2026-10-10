/**
 * NEXORA MD - TikTok Downloader
 * Inline scraper — no external API, no npm install
 * Uses tikwm.com with browser headers (bypasses Cloudflare block)
 */

const settings = require('../../settings');
const axios = require('axios');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function resolveTikTok(url) {
  // Strategy 1: tikwm.com (with full browser headers)
  try {
    console.log('[TD] Strategy 1: tikwm');
    const res = await axios.post(
      'https://www.tikwm.com/api/',
      new URLSearchParams({ url, hd: '1' }).toString(),
      {
        timeout: 30000,
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://www.tikwm.com',
          'Referer': 'https://www.tikwm.com/'
        }
      }
    );

    const d = res.data;
    console.log('[TD] tikwm raw:', JSON.stringify(d).slice(0, 400));

    if (d?.code === 0 && d.data) {
      return {
        video: d.data.hdplay || d.data.play,
        music: d.data.music,
        title: d.data.title || 'TikTok Video',
        author: d.data.author?.nickname || d.data.author?.unique_id || 'Unknown'
      };
    }
  } catch (e) {
    console.log('[TD] tikwm fail:', e.message);
  }

  // Strategy 2: tikwm via GET (some hosts prefer it)
  try {
    console.log('[TD] Strategy 2: tikwm GET');
    const res = await axios.get(
      `https://tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`,
      {
        timeout: 30000,
        headers: {
          'User-Agent': UA,
          'Accept': 'application/json',
          'Referer': 'https://tikwm.com/'
        }
      }
    );

    const d = res.data;
    if (d?.code === 0 && d.data) {
      return {
        video: d.data.hdplay || d.data.play,
        music: d.data.music,
        title: d.data.title || 'TikTok Video',
        author: d.data.author?.nickname || d.data.author?.unique_id || 'Unknown'
      };
    }
  } catch (e) {
    console.log('[TD] tikwm GET fail:', e.message);
  }

  // Strategy 3: douyin.wtf mirror
  try {
    console.log('[TD] Strategy 3: douyin.wtf');
    const res = await axios.get(
      `https://api.douyin.wtf/api/hybrid/video_data?url=${encodeURIComponent(url)}&minimal=false`,
      {
        timeout: 30000,
        headers: { 'User-Agent': UA, 'Accept': 'application/json' }
      }
    );

    const d = res.data;
    if (d?.data) {
      const v = d.data.video || d.data;
      const playAddr = v?.play_addr?.url_list?.[0] || v?.play_addr?.url_list?.[1];
      if (playAddr) {
        return {
          video: playAddr,
          music: d.data.music?.play_url?.url_list?.[0],
          title: d.data.desc || 'TikTok Video',
          author: d.data.author?.nickname || 'Unknown'
        };
      }
    }
  } catch (e) {
    console.log('[TD] douyin.wtf fail:', e.message);
  }

  return null;
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
        await conn.sendMessage(chatId, {
          text:
            `TikTok Downloader\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}td <tiktok-url>\n` +
            `  Reply to a message with ${settings.prefix || '.'}td\n\n` +
            `${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Downloading TikTok...` });

      const info = await resolveTikTok(url);

      if (!info || !info.video) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `TikTok download failed.\n\nAll strategies returned no video URL.\n\n${settings.footer}`
        });
        return;
      }

      const caption =
        `TIKTOK\n\n` +
        `Title: ${info.title}\n` +
        `Author: ${info.author}\n\n` +
        `${settings.footer}`;

      try {
        await conn.sendMessage(chatId, {
          video: { url: info.video },
          caption,
          mimetype: 'video/mp4',
          fileName: `tiktok_${Date.now()}.mp4`
        }, { quoted: mek });

        console.log('[TD] Video sent');

        if (info.music) {
          try {
            await conn.sendMessage(chatId, {
              audio: { url: info.music },
              mimetype: 'audio/mp4',
              fileName: `tiktok_audio_${Date.now()}.mp3`,
              ptt: false
            }, { quoted: mek });
          } catch (e) { console.log('[TD] Audio fail:', e.message); }
        }
      } catch (sendErr) {
        console.log('[TD] Send fail:', sendErr.message);
        await conn.sendMessage(chatId, {
          text: `Send failed: ${sendErr.message}\n\nLink:\n${info.video}\n\n${settings.footer}`
        });
      }

    } catch (error) {
      console.log('[TD] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, { text: `Error: ${error.message}\n\n${settings.footer}` });
    }
  }
};