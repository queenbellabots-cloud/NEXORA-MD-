/**
 * NEXORA MD - Auto-detect & Translate
 * Reply to a message → bot detects language and translates to English
 * Usage: .detect (reply to a message)
 */

const settings = require('../../settings');
const axios = require('axios');

module.exports = {
  name: 'detect',
  aliases: ['autotranslate', 'tolang'],
  category: 'general',
  description: 'Detect language and translate to English',
  usage: '.detect (reply to a message)',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;

      let text = args.join(' ').trim();

      if (!text && quoted) {
        text =
          quoted.conversation ||
          quoted.extendedTextMessage?.text ||
          quoted.imageMessage?.caption ||
          quoted.videoMessage?.caption ||
          '';
      }

      if (!text) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Reply to a message or type text to translate.\n\n${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
      const res = await axios.get(url, { timeout: 20000 });

      if (!Array.isArray(res.data) || !Array.isArray(res.data[0])) {
        throw new Error('Bad response');
      }

      const translated = res.data[0].map(p => p[0]).join('');
      const detectedLang = res.data[2] || 'unknown';

      await conn.sendMessage(chatId, {
        text:
          `DETECTED & TRANSLATED\n\n` +
          `Detected language: ${detectedLang}\n\n` +
          `Original:\n${text.slice(0, 500)}\n\n` +
          `English:\n${translated}\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[DETECT] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Translation failed: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};