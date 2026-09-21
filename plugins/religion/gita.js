/**
 * NEXORA MD - Bhagavad Gita
 * Fetches a random verse from the Bhagavad Gita
 * API: bhagavadgitaapi.in (free, no key required)
 * Usage: .gita
 */

const settings = require('../../settings');
const axios = require('axios');

module.exports = {
  name: 'gita',
  aliases: ['bhagavadgita', 'holybook'],
  category: 'religion',
  description: 'Get a random verse from the Bhagavad Gita',
  usage: '.gita',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      // The API base URL is bhagavadgitaapi.in, and no key is required[citation:25].
      // This endpoint retrieves a random sloka (verse).
      const res = await axios.get('https://bhagavadgitaapi.in/slok', { timeout: 15000 });
      
      // The API response contains the verse data in a nested structure.
      const data = res.data;

      if (!data || !data.slok || !data.transliteration || !data.tej) {
        throw new Error('Invalid or empty API response');
      }

      // Construct the message with Chapter, Verse, Sanskrit, and English translation.
      const reference = `Chapter ${data.chapter}: Verse ${data.verse}`;
      const sanskrit = data.slok;
      const translation = data.tej; // 'tej' corresponds to the translation by Swami Tejomayananda

      const text = `BHAGAVAD GITA\n\n${reference}\n\n${sanskrit}\n\n${translation}\n\n${settings.footer}`;

      await conn.sendMessage(chatId, { text });

    } catch (error) {
      console.log('[GITA] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, { text: `Failed to fetch verse.\n\n${settings.footer}` });
    }
  }
};