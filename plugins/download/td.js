const axios = require('axios');

module.exports = {
  name: 'td',
  aliases: ['tiktok', 'tt'],
  category: 'download',
  description: 'Download TikTok video without watermark',
  usage: '.td <tiktok-url>',

  async execute(conn, mek, args, chatId) {
    // ── 1. Get URL ──
    let url = args[0];

    if (!url) {
      const quoted =
        mek.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation ||
        mek.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text;
      if (quoted) url = quoted.split(' ').find(x => x.includes('tiktok.com'));
    }

    if (!url || !url.includes('tiktok.com')) {
      return conn.sendMessage(
        chatId,
        { text: '❌ *Usage:* `.td <tiktok-link>`\n\nOr reply to a message containing a TikTok link.' },
        { quoted: mek }
      );
    }

    await conn.sendMessage(chatId, { react: { text: '⏳', key: mek.key } });

    let info = null;

    // ═════════════════════════════════════════
    // PROVIDER 1 — tikwm.com
    // ═════════════════════════════════════════
    try {
      console.log('[TD] Provider 1/2: tikwm.com');
      const { data } = await axios.get(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`,
        { timeout: 25000 }
      );

      if (data?.code === 0 && data.data) {
        const d = data.data;
        info = {
          title: d.title || 'No title',
          author: d.author?.nickname || d.author?.unique_id || 'Unknown',
          duration: d.duration || '?',
          views: d.play_count || 0,
          likes: d.digg_count || 0,
          comments: d.comment_count || 0,
          video: d.hdplay || d.play,
          music: d.music || null,
          source: 'tikwm.com'
        };
        console.log('[TD] ✅ tikwm.com');
      } else {
        throw new Error(data?.msg || 'tikwm returned no data');
      }
    } catch (e) {
      console.log('[TD] ❌ tikwm.com:', e.message);
    }

    // ═════════════════════════════════════════
    // PROVIDER 2 — David Cyril TikTokDL3
    // ═════════════════════════════════════════
    if (!info) {
      try {
        console.log('[TD] Provider 2/2: David Cyril tiktokdl3');
        const { data } = await axios.get(
          `https://apis.davidcyril.name.ng/download/tiktokdl3?url=${encodeURIComponent(url)}`,
          {
            timeout: 25000,
            headers: { 'Accept': 'application/json' }
          }
        );

        // Different APIs return different shapes — detect common ones
        const payload = data?.result || data?.data || data;

        // Common keys used by these wrappers
        const videoUrl =
          payload?.video ||
          payload?.videoUrl ||
          payload?.play ||
          payload?.hd ||
          payload?.noWatermark ||
          payload?.no_watermark ||
          payload?.download_url ||
          payload?.url;

        const musicUrl =
          payload?.music ||
          payload?.audio ||
          payload?.musicUrl ||
          payload?.audioUrl ||
          null;

        if (!videoUrl || typeof videoUrl !== 'string') {
          throw new Error('tiktokdl3 returned no video URL');
        }

        info = {
          title: payload?.title || payload?.desc || 'No title',
          author:
            payload?.author?.nickname ||
            payload?.author?.unique_id ||
            payload?.author ||
            payload?.username ||
            'Unknown',
          duration: payload?.duration || '?',
          views: payload?.play_count || payload?.views || 0,
          likes: payload?.digg_count || payload?.likes || 0,
          comments: payload?.comment_count || payload?.comments || 0,
          video: videoUrl,
          music: musicUrl,
          source: 'tiktokdl3'
        };
        console.log('[TD] ✅ tiktokdl3');
      } catch (e) {
        console.log('[TD] ❌ tiktokdl3:', e.message);
      }
    }

    // ── Both failed ──
    if (!info) {
      await conn.sendMessage(
        chatId,
        {
          text:
            `❌ *Download failed*\n\n` +
            `All providers failed. The link may be:\n` +
            `• Region-locked (TikTok is discontinued in some regions)\n` +
            `• Private or deleted\n` +
            `• An unsupported format (photo slideshow, live)`
        },
        { quoted: mek }
      );
      return conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
    }

    // ── Build caption ──
    const caption =
      `🎵 *TikTok Downloader*\n\n` +
      `📝 *Title:* ${info.title}\n` +
      `👤 *Author:* ${info.author}\n` +
      `⏱ *Duration:* ${info.duration}s\n` +
      `👁 *Views:* ${Number(info.views).toLocaleString()}\n` +
      `❤️ *Likes:* ${Number(info.likes).toLocaleString()}\n` +
      `💬 *Comments:* ${Number(info.comments).toLocaleString()}\n` +
      `🌐 *Source:* ${info.source}`;

    // ── Send video ──
    try {
      await conn.sendMessage(
        chatId,
        {
          video: { url: info.video },
          caption,
          mimetype: 'video/mp4',
          fileName: `tiktok_${Date.now()}.mp4`
        },
        { quoted: mek }
      );
    } catch (videoErr) {
      console.log('[TD] Video send failed:', videoErr.message);
      await conn.sendMessage(
        chatId,
        { text: `❌ Failed to send video: ${videoErr.message}` },
        { quoted: mek }
      );
      return conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
    }

    // ── Optional audio ──
    if (info.music) {
      try {
        await conn.sendMessage(
          chatId,
          {
            audio: { url: info.music },
            mimetype: 'audio/mp4',
            fileName: `tiktok_audio_${Date.now()}.mp3`,
            ptt: false
          },
          { quoted: mek }
        );
      } catch (audioErr) {
        console.log('[TD] Audio send failed:', audioErr.message);
      }
    }

    await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
  }
};