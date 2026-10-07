/**
 * NEXORA MD - AI Logo Generator
 * Generate logos from a text prompt via Omegatech
 * Usage:
 *   .logo <prompt>            → list top results
 *   .logo <prompt> | <number> → fetch that specific logo
 */

const settings = require('../../settings');
const axios = require('axios');

const API_URL = 'https://api.omegatech.app/api/ai/Ai-logo';

// Cache last search per chat
const lastSearch = new Map();

module.exports = {
  name: 'logo',
  aliases: ['ailogo', 'logogen', 'brand'],
  category: 'ai',
  description: 'Generate AI logos from a text prompt',
  usage: '.logo <prompt> | .logo <prompt> | <number>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const fullInput = args.join(' ').trim();

      if (!fullInput) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `AI Logo Generator\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}logo <prompt>\n` +
            `  ${settings.prefix || '.'}logo <prompt> | <number>\n\n` +
            `Examples:\n` +
            `  ${settings.prefix || '.'}logo a car\n` +
            `  ${settings.prefix || '.'}logo a car | 1\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // Parse "prompt | number" pattern
      let query = fullInput;
      let pickIndex = null;

      if (fullInput.includes('|')) {
        const parts = fullInput.split('|').map(s => s.trim());
        query = parts[0];
        pickIndex = parseInt(parts[1]);
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      // ═════════════════════════════════════════
      // PICK FROM CACHED LIST
      // ═════════════════════════════════════════
      if (pickIndex !== null && lastSearch.has(chatId)) {
        const cached = lastSearch.get(chatId);
        if (isNaN(pickIndex) || pickIndex < 1 || pickIndex > cached.logos.length) {
          await conn.sendMessage(chatId, {
            text: `Invalid selection. Pick 1-${cached.logos.length}\n\n${settings.footer}`
          });
          return;
        }

        const picked = cached.logos[pickIndex - 1];
        await sendLogo(conn, mek, chatId, picked, cached.prompt);
        return;
      }

      // ═════════════════════════════════════════
      // FRESH SEARCH
      // ═════════════════════════════════════════
      await conn.sendMessage(chatId, { text: `Generating logos for "${query}"...` });

      let response = null;
      try {
        const url = `${API_URL}?action=generate&prompt=${encodeURIComponent(query)}`;
        const res = await axios.get(url, {
          timeout: 45000,
          headers: { 'Accept': 'application/json' }
        });
        response = res.data;
      } catch (e) {
        console.log('[LOGO] API error:', e.message);
      }

      const logos = response?.data?.logos || [];

      if (logos.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `No logos generated for "${query}".\n\n${settings.footer}`
        });
        return;
      }

      // Cache
      lastSearch.set(chatId, { prompt: query, logos });

      // Dedupe by logoToken to show variety
      const seen = new Set();
      const unique = [];
      for (const l of logos) {
        if (!seen.has(l.logoToken)) {
          seen.add(l.logoToken);
          unique.push(l);
        }
        if (unique.length >= 8) break;
      }

      let text = `AI LOGO — "${query}"\n\n`;
      text += `Found ${logos.length} designs (${unique.length} unique styles)\n\n`;

      unique.forEach((l, i) => {
        const free = l.isFree ? '[FREE]' : '[PAID]';
        text += `${i + 1}. ${l.designName} ${free}\n`;
        text += `   ${l.templateCategory} | ${l.templateType}\n\n`;
      });

      text += `Pick one: ${settings.prefix || '.'}logo ${query} | <number>\n`;
      text += `Example: ${settings.prefix || '.'}logo ${query} | 1\n\n`;
      text += `${settings.footer}`;

      await conn.sendMessage(chatId, { text });
      console.log(`[LOGO] Generated ${logos.length} logos for "${query}"`);

    } catch (error) {
      console.log('[LOGO] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};

// ═══════════════════════════════════════════════════════
// SEND LOGO IMAGE
// ═══════════════════════════════════════════════════════
async function sendLogo(conn, mek, chatId, logo, prompt) {
  try {
    const caption =
      `AI LOGO\n\n` +
      `Prompt: ${prompt}\n` +
      `Design: ${logo.designName}\n` +
      `Category: ${logo.templateCategory}\n` +
      `Type: ${logo.templateType}\n` +
      `Access: ${logo.isFree ? 'Free' : 'Paid'}\n\n` +
      `${settings.footer}`;

    await conn.sendMessage(chatId, {
      image: { url: logo.imageUrl },
      caption
    }, { quoted: mek });

    console.log(`[LOGO] Sent "${logo.designName}" for "${prompt}"`);
  } catch (error) {
    console.log('[LOGO] Send failed:', error.message);
    try {
      await conn.sendMessage(chatId, {
        text: `Failed to send logo image: ${error.message}\n\n${settings.footer}`
      });
    } catch (e) {}
  }
}