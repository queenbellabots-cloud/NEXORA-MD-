/**
 * NEXORA MD - Torah (Random Verse)
 * Fetches a random verse from the Torah via Sefaria API
 * API: sefaria.org (free, no key required)
 * Usage: .torah
 */

const settings = require('../../settings');
const axios = require('axios');

module.exports = {
  name: 'torah',
  aliases: ['tanakh', 'jewishscripture'],
  category: 'religion',
  description: 'Get a random verse from the Torah',
  usage: '.torah',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      // Sefaria API: Get a random text from the Tanakh (Torah, Prophets, Writings).
      // The 'get_random_text' endpoint is part of the Sefaria API suite [citation:5][citation:6].
      const res = await axios.get('https://www.sefaria.org/api/texts/random?category=Tanakh', {
        timeout: 15000,
        headers: { 'Accept': 'application/json' }
      });

      const data = res.data;

      if (!data || !data.text) {
        throw new Error('No text returned from API');
      }

      // The 'ref' field provides the reference (e.g., "Genesis 1:1").
      // The 'text' field may be an array (for chapters) or a string.
      let textContent = data.text;
      if (Array.isArray(textContent)) {
        textContent = textContent.join(' ');
      }

      // The 'he' field provides the Hebrew text.
      const hebrewText = data.he || '';

      let message = `TORAH VERSE\n\n${data.ref}\n\n`;
      if (hebrewText) {
        message += `${hebrewText}\n\n`;
      }
      message += `${textContent}\n\n${settings.footer}`;

      await conn.sendMessage(chatId, { text: message });

    } catch (error) {
      console.log('[TORAH] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, { text: `Failed to fetch verse.\n\n${settings.footer}` });
    }
  }
};