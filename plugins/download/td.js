/**
 * NEXORA MD - TikTok Downloader
 * Multi-provider: works from datacenter IPs
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
      let url = args.join(' ').trim();

      if (!url) {
        const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
        const quoted = contextInfo?.quotedMessage;
        if (quoted) {
          const text = quoted.conversation || quoted.extendedTextMessage?.text || '';
          const found = text.split(/\s+/).find(x => x.includes('tiktok.com'));
          if (found) url = found;
        }
      }

      if (!url || !url.includes('tiktok.com')) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `TikTok Downloader\n\nUsage: ${settings.prefix || '.'}td <tiktok-url>\n\n${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Downloading TikTok...` });

      let videoUrl = null;
      let musicUrl = null;
      let title = 'TikTok Video';
      let author = 'Unknown';
      let used = '';

      // ═════════════════════════════════════════
      // PROVIDER 1 — tiklydown.eu.org
      // ═════════════════════════════════════════
      if (!videoUrl) {
        try {
          console.log('[TD] 1/5 tiklydown');
          const res = await axios.get(
            `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
            { timeout: 30000, headers: { 'Accept': 'application/json' } }
          );
          const d = res.data;
          console.log('[TD] tiklydown:', JSON.stringify(d).slice(0, 400));

          videoUrl = d?.video?.noWatermark || d?.video?.watermark || d?.video?.playAddr;
          musicUrl = d?.music?.playUrl || d?.music?.url || null;
          title = d?.title || title;
          author = d?.author?.name || d?.author?.unique_id || author;
          if (videoUrl) used = 'tiklydown';
        } catch (e) { console.log('[TD] ❌ tiklydown:', e.message); }
      }

      // ═════════════════════════════════════════
      // PROVIDER 2 — tiktokdownload.online
      // ═════════════════════════════════════════
      if (!videoUrl) {
        try {
          console.log('[TD] 2/5 tiktokdownload.online');
          const res = await axios.get(
            `https://tiktokdownload.online/api/download?url=${encodeURIComponent(url)}`,
            { timeout: 30000, headers: { 'Accept': 'application/json' } }
          );
          const d = res.data;
          console.log('[TD] tiktokdownload:', JSON.stringify(d).slice(0, 400));

          videoUrl = d?.video || d?.play || d?.data?.video || d?.data?.play;
          musicUrl = d?.music || d?.data?.music || null;
          title = d?.title || d?.data?.title || title;
          if (videoUrl) used = 'tiktokdownload.online';
        } catch (e) { console.log('[TD] ❌ tiktokdownload:', e.message); }
      }

      // ═════════════════════════════════════════
      // PROVIDER 3 — ssstik.io (scrape)
      // ═════════════════════════════════════════
      if (!videoUrl) {
        try {
          console.log('[TD] 3/5 ssstik.io');
          const res = await axios.post(
            'https://ssstik.io/abc?url=dl',
            new URLSearchParams({ id: url, locale: 'en', tt: 'abc' }).toString(),
            {
              timeout: 30000,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'Origin': 'https://ssstik.io',
                'Referer': 'https://ssstik.io/en'
              }
            }
          );
          const html = res.data;
          const match = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
          if (match) {
            videoUrl = match[1];
            used = 'ssstik';
            console.log('[TD] ssstik URL:', videoUrl);
          }
        } catch (e) { console.log('[TD] ❌ ssstik:', e.message); }
      }

      // ═════════════════════════════════════════
      // PROVIDER 4 — your tiktokdl3
      // ═════════════════════════════════════════
      if (!videoUrl) {
        try {
          console.log('[TD] 4/5 tiktokdl3');
          const res = await axios.get(
            `https://apis.davidcyril.name.ng/download/tiktokdl3?url=${encodeURIComponent(url)}`,
            { timeout: 45000, headers: { 'Accept': 'application/json' } }
          );
          const d = res.data;
          console.log('[TD] tiktokdl3:', JSON.stringify(d).slice(0, 400));

          const p = d?.result || d?.data || d;
          videoUrl = p?.video || p?.videoUrl || p?.no_watermark || p?.play || p?.hd;
          musicUrl = p?.music || p?.audio || null;
          title = p?.title || p?.desc || title;
          author = p?.author?.nickname || p?.author?.unique_id || p?.author || author;
          if (videoUrl) used = 'tiktokdl3';
        } catch (e) { console.log('[TD] ❌ tiktokdl3:', e.message); }
      }

      // ═════════════════════════════════════════
      // PROVIDER 5 — tikwm with browser UA (bypass 403)
      // ═════════════════════════════════════════
      if (!videoUrl) {
        try {
          console.log('[TD] 5/5 tikwm (browser UA)');
          const res = await axios.get(
            `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`,
            {
              timeout: 30000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Referer': 'https://www.tikwm.com/'
              }
            }
          );
          const d = res.data;
          console.log('[TD] tikwm:', JSON.stringify(d).slice(0, 400));

          if (d?.code === 0 && d.data) {
            videoUrl = d.data.hdplay || d.data.play;
            musicUrl = d.data.music;
            title = d.data.title || title;
            author = d.data.author?.nickname || d.data.author?.unique_id || author;
            if (videoUrl) used = 'tikwm';
          }
        } catch (e) { console.log('[TD] ❌ tikwm:', e.message); }
      }

      // ── All failed ──
      if (!videoUrl) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `All providers failed.\n\nCheck console for [TD] logs.\n\n${settings.footer}`
        });
        return;
      }

      console.log('[TD] ✅ Video from:', used);

      const caption =
        `TIKTOK\n\n` +
        `Title: ${title}\n` +
        `Author: ${author}\n` +
        `Source: ${used}\n\n` +
        `${settings.footer}`;

      try {
        await conn.sendMessage(chatId, {
          video: { url: videoUrl },
          caption,
          mimetype: 'video/mp4',
          fileName: `tiktok_${Date.now()}.mp4`
        }, { quoted: mek });

        console.log(`[TD] Video sent via ${used}`);

        if (musicUrl) {
          try {
            await conn.sendMessage(chatId, {
              audio: { url: musicUrl },
              mimetype: 'audio/mp4',
              fileName: `tiktok_audio_${Date.now()}.mp3`,
              ptt: false
            }, { quoted: mek });
          } catch (e) { console.log('[TD] Audio fail:', e.message); }
        }
      } catch (sendErr) {
        console.log('[TD] Send fail:', sendErr.message);
        await conn.sendMessage(chatId, {
          text: `Send failed: ${sendErr.message}\n\nDirect link:\n${videoUrl}\n\n${settings.footer}`
        });
      }

    } catch (error) {
      console.log('[TD] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, { text: `Error: ${error.message}` });
    }
  }
};