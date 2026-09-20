/**
 * NEXORA MD - Translate
 * Free Google Translate endpoint (no key)
 * Usage:
 *   .translate <lang> <text>
 *   .translate <lang> (reply to a message)
 */

const settings = require('../../settings');
const axios = require('axios');

const LANG_NAMES = {
  en: 'English', sw: 'Kiswahili', fr: 'French', es: 'Spanish', de: 'German',
  pt: 'Portuguese', it: 'Italian', ru: 'Russian', ar: 'Arabic', hi: 'Hindi',
  zh: 'Chinese', ja: 'Japanese', ko: 'Korean', tr: 'Turkish', nl: 'Dutch',
  pl: 'Polish', vi: 'Vietnamese', th: 'Thai', id: 'Indonesian', ur: 'Urdu'
};

async function translateText(text, target) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await axios.get(url, { timeout: 20000 });
  if (!Array.isArray(res.data) || !Array.isArray(res.data[0])) throw new Error('Bad response');
  return res.data[0].map(part => part[0]).join('');
}

module.exports = {
  name: 'translate',
  aliases: ['tr', 'trans'],
  category: 'tools',
  description: 'Translate text between languages',
  usage: '.translate <lang> <text>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const lang = (args[0] || '').toLowerCase();
      let text = args.slice(1).join(' ').trim();

      if (!lang) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Translate text\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}translate <lang> <text>\n` +
            `  Reply to a message with ${settings.prefix || '.'}translate <lang>\n\n` +
            `Example:\n` +
            `  ${settings.prefix || '.'}translate es Hello world\n\n` +
            `Languages: en, sw, fr, es, de, pt, it, ru, ar, hi, zh, ja, ko, tr, nl, pl, vi, th, id, ur\n\n` +
            `${settings.footer}`
        });
        return;
      }

      if (!text) {
        const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted) {
          text =
            quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            quoted.imageMessage?.caption ||
            quoted.videoMessage?.caption ||
            '';
        }
      }

      if (!text) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Text to translate is required.\n\n${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Translating...` });

      const translated = await translateText(text, lang);
      const langName = LANG_NAMES[lang] || lang.toUpperCase();

      await conn.sendMessage(chatId, {
        text:
          `Translation (${langName})\n\n` +
          `Original:\n${text.slice(0, 500)}\n\n` +
          `Translated:\n${translated}\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[TRANSLATE] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, { text: `Error: ${error.message}\n\n${settings.footer}` });
      } catch (e) {}
    }
  }
};