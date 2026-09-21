/**
 * NEXORA MD - Bible Lookup
 * Look up a specific Bible verse
 * Usage: .biblelookup John 3:16
 */

const settings = require('../../settings');
const axios = require('axios');

module.exports = {
  name: 'biblelookup',
  aliases: ['verse', 'bibleverse'],
  category: 'religion',
  description: 'Look up a specific Bible verse',
  usage: '.biblelookup <book chapter:verse>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const query = args.join(' ').trim();
      
      if (!query) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Bible Lookup\n\nUsage: ${settings.prefix || '.'}biblelookup John 3:16\n\nExample: ${settings.prefix || '.'}biblelookup Psalm 23\n\n${settings.footer}`
        });
        return;
      }
      
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      
      const res = await axios.get(`https://labs.bible.org/api/?passage=${encodeURIComponent(query)}&type=json`, { timeout: 15000 });
      
      if (!res.data || !Array.isArray(res.data) || res.data.length === 0) {
        throw new Error('No verses found');
      }
      
      // Group verses by chapter
      let text = `BIBLE LOOKUP\n\n`;
      res.data.forEach(verse => {
        text += `${verse.bookname} ${verse.chapter}:${verse.verse}\n${verse.text}\n\n`;
      });
      
      // Truncate if too long
      if (text.length > 4000) {
        text = text.slice(0, 3950) + '...\n\n' + settings.footer;
      } else {
        text += settings.footer;
      }
      
      await conn.sendMessage(chatId, { text });
    } catch (error) {
      console.log('[BIBLELOOKUP] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, { text: `Verse not found or lookup failed.\n\n${settings.footer}` });
    }
  }
};