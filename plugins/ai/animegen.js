/**
 * NEXORA MD - Anime Generation
 * Generate anime images from a prompt
 * Usage:
 *   .animegen styles                 → list available styles
 *   .animegen <prompt>               → generate with default style (Cool)
 *   .animegen <prompt> | <style>     → generate with specific style
 */

const settings = require('../../settings');
const axios = require('axios');

const API_URL = 'https://api.omegatech.app/api/ai/Anime-generation';

// Default style if user doesn't specify
const DEFAULT_STYLE = 'Cool';

// Fallback styles if API `styles` action fails
const FALLBACK_STYLES = ['Cool', 'Cute', 'Dark', 'Kawaii', 'Realistic', 'Cyberpunk', 'Fantasy', 'Retro'];

// ═══════════════════════════════════════════════════════
// FLEXIBLE PARSERS — handle both shapes
// ═══════════════════════════════════════════════════════

// Extract an image URL from a generate response
function extractImageUrl(data) {
  if (!data) return null;

  if (typeof data === 'string' && data.startsWith('http')) return data;

  const candidate =
    data?.url ||
    data?.imageUrl ||
    data?.image ||
    data?.result ||
    data?.link ||
    data?.data?.url ||
    data?.data?.imageUrl ||
    data?.data?.image ||
    data?.data?.result ||
    null;

  if (typeof candidate === 'string' && candidate.startsWith('http')) return candidate;

  // Sometimes image URLs are inside an array
  const arr =
    data?.images ||
    data?.results ||
    data?.data?.images ||
    data?.data?.results ||
    null;

  if (Array.isArray(arr) && arr.length > 0) {
    const first = arr[0];
    if (typeof first === 'string' && first.startsWith('http')) return first;
    if (first?.url) return first.url;
    if (first?.imageUrl) return first.imageUrl;
  }

  return null;
}

// Extract a list of styles from a styles response
function extractStyles(data) {
  if (!data) return [];

  const arr =
    data?.styles ||
    data?.data?.styles ||
    data?.list ||
    data?.data?.list ||
    (Array.isArray(data) ? data : null) ||
    (Array.isArray(data?.data) ? data.data : null);

  if (!Array.isArray(arr)) return [];

  return arr.map(s => {
    if (typeof s === 'string') return s;
    return s?.name || s?.style || s?.label || JSON.stringify(s);
  }).filter(Boolean);
}

module.exports = {
  name: 'animegen',
  aliases: ['anime', 'animeai', 'ag'],
  category: 'ai',
  description: 'Generate anime images from text',
  usage: '.animegen <prompt> | <style>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const fullInput = args.join(' ').trim();
      const rawSend = global.rawSendMessage || conn.sendMessage.bind(conn);

      if (!fullInput) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Anime Generator\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}animegen <prompt>\n` +
            `  ${settings.prefix || '.'}animegen <prompt> | <style>\n` +
            `  ${settings.prefix || '.'}animegen styles\n\n` +
            `Examples:\n` +
            `  ${settings.prefix || '.'}animegen a girl in the rain\n` +
            `  ${settings.prefix || '.'}animegen a samurai | Dark\n` +
            `  ${settings.prefix || '.'}animegen styles\n\n` +
            `${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      // ═════════════════════════════════════════
      // ACTION: styles
      // ═════════════════════════════════════════
      if (fullInput.toLowerCase() === 'styles') {
        await conn.sendMessage(chatId, { text: `Fetching available styles...` });

        let data = null;
        try {
          const url = `${API_URL}?action=styles&prompt=test&style=Cool&raw=false`;
          const res = await axios.get(url, {
            timeout: 20000,
            headers: { 'Accept': 'application/json' }
          });
          data = res.data;
        } catch (e) {
          console.log('[ANIMEGEN] Styles fetch failed:', e.message);
        }

        let styles = extractStyles(data);
        if (styles.length === 0) styles = FALLBACK_STYLES;

        let text = `ANIME STYLES\n\n`;
        styles.forEach((s, i) => {
          text += `${i + 1}. ${s}\n`;
        });
        text += `\nUse: ${settings.prefix || '.'}animegen <prompt> | <style>\n\n`;
        text += `${settings.footer}`;

        await rawSend(chatId, { text });
        return;
      }

      // ═════════════════════════════════════════
      // ACTION: generate
      // ═════════════════════════════════════════
      let prompt = fullInput;
      let style = DEFAULT_STYLE;

      if (fullInput.includes('|')) {
        const parts = fullInput.split('|').map(s => s.trim());
        prompt = parts[0];
        style = parts[1] || DEFAULT_STYLE;
      }

      if (!prompt) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Provide a prompt.\n\n${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { text: `Generating anime with style "${style}"...` });

      let data = null;
      try {
        const url = `${API_URL}?action=generate&prompt=${encodeURIComponent(prompt)}&style=${encodeURIComponent(style)}&raw=false`;
        console.log('[ANIMEGEN] Requesting:', url.split('&prompt=')[0]);

        const res = await axios.get(url, {
          timeout: 60000,
          headers: { 'Accept': 'application/json' }
        });
        data = res.data;
      } catch (e) {
        console.log('[ANIMEGEN] Generate failed:', e.message);
      }

      const imageUrl = extractImageUrl(data);

      if (!imageUrl) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Could not generate image. Try again later.\n\n${settings.footer}`
        });
        return;
      }

      const caption =
        `ANIME GENERATED\n\n` +
        `Prompt: ${prompt}\n` +
        `Style: ${style}\n\n` +
        `${settings.footer}`;

      await rawSend(chatId, {
        image: { url: imageUrl },
        caption
      }, { quoted: mek });

      console.log(`[ANIMEGEN] Sent image for "${prompt}" (style: ${style})`);

    } catch (error) {
      console.log('[ANIMEGEN] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};