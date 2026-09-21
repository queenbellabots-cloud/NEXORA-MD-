/**
 * NEXORA MD - Bible (Random Verse)
 * Fetches a random verse from labs.bible.org API
 * Usage: .bible
 */

const settings = require('../../settings');
const axios = require('axios');

module.exports = {
  name: 'bible',
  aliases: ['verse', 'scripture'],
  category: 'religion',
  description: 'Get a random Bible verse',
  usage: '.bible',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      
      const res = await axios.get('https://labs.bible.org/api/?passage=random&type=json', { timeout: 15000 });
      const verse = res.data?.[0];
      
      if (!verse) throw new Error('No verse returned');
      
      const reference = `${verse.bookname} ${verse.chapter}:${verse.verse}`;
      
      await conn.sendMessage(chatId, {
        text: `BIBLE VERSE\n\n${reference}\n\n${verse.text}\n\n${settings.footer}`
      });
    } catch (error) {
      console.log('[BIBLE] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, { text: `Failed to fetch verse.\n\n${settings.footer}` });
    }
  }
};