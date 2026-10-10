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

    let videoUrl = null;
    let musicUrl = null;
    let title = 'TikTok Video';
    let author = 'Unknown';
    let used = '';

    // ═════════════════════════════════════════
    // PROVIDER 1 — tiktokdl3 (the one you gave)
    // ═════════════════════════════════════════
    try {
      console.log('[TD] Provider 1/2: tiktokdl3');
      const { data } = await axios.get(
        `https://apis.davidcyril.name.ng/download/tiktokdl3?url=${encodeURIComponent(url)}`,
        { timeout: 30000, headers: { 'Accept': 'application/json' } }
      );

      console.log('[TD] tiktokdl3 raw:', JSON.stringify(data).slice(0, 500));

      const p = data?.result || data?.data || data;

      videoUrl =
        p?.video ||
        p?.videoUrl ||
        p?.no_watermark ||
        p?.nowatermark ||
        p?.play ||
        p?.hd ||
        p?.download ||
        (Array.isArray(p?.videos) && p.videos[0]?.url) ||
        null;

      musicUrl = p?.music || p?.audio || p?.musicUrl || null;
      title = p?.title || p?.desc || title;
      author = p?.author?.nickname || p?.author?.unique_id || p?.author || author;

      if (videoUrl) used = 'tiktokdl3';
      else throw new Error('no video url in response');
    } catch (e) {
      console.log('[TD] ❌ tiktokdl3:', e.message);
      videoUrl = null;
    }

    // ═════════════════════════════════════════
    // PROVIDER 2 — tikwm.com (fallback)
    // ═════════════════════════════════════════
    if (!videoUrl) {
      try {
        console.log('[TD] Provider 2/2: tikwm');
        const { data } = await axios.get(
          `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`,
          { timeout: 30000 }
        );

        if (data?.code === 0 && data.data) {
          const d = data.data;
          videoUrl = d.hdplay || d.play;
          musicUrl = d.music;
          title = d.title || title;
          author = d.author?.nickname || d.author?.unique_id || author;
          used = 'tikwm';
        }
      } catch (e) {
        console.log('[TD] ❌ tikwm:', e.message);
      }
    }

    // ── Both failed ──
    if (!videoUrl) {
      await conn.sendMessage(
        chatId,
        {
          text:
            `❌ *Download failed*\n\n` +
            `Both providers failed. The link may be region-locked, private, or deleted.`
        },
        { quoted: mek }
      );
      return conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
    }

    // ── Caption ──
    const caption =
      `🎵 *TikTok Downloader*\n\n` +
      `📝 *Title:* ${title}\n` +
      `👤 *Author:* ${author}\n` +
      `🌐 *Source:* ${used}`;

    // ── Send video ──
    try {
      await conn.sendMessage(
        chatId,
        {
          video: { url: videoUrl },
          caption,
          mimetype: 'video/mp4',
          fileName: `tiktok_${Date.now()}.mp4`
        },
        { quoted: mek }
      );
    } catch (err) {
      console.log('[TD] Video send failed:', err.message);
      return conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
    }

    // ── Optional audio ──
    if (musicUrl) {
      try {
        await conn.sendMessage(
          chatId,
          {
            audio: { url: musicUrl },
            mimetype: 'audio/mp4',
            fileName: `tiktok_audio_${Date.now()}.mp3`,
            ptt: false
          },
          { quoted: mek }
        );
      } catch (e) { console.log('[TD] Audio failed:', e.message); }
    }

    await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
  }
};