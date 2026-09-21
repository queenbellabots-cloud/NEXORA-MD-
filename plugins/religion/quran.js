/**
 * NEXORA MD - Quran
 * Fetches a random verse using the AlQuran Cloud API (no key required)
 * Usage: .quran
 */

const settings = require('../../settings');
const axios = require('axios');

module.exports = {
  name: 'quran',
  aliases: ['ayah', 'quranverse'],
  category: 'religion',
  description: 'Get a random Quran verse',
  usage: '.quran',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      
      // Fetch random verse with Arabic text and English translation
      const res = await axios.get('https://api.alquran.cloud/v1/ayah/random/en.asad', { timeout: 15000 });
      const data = res.data?.data;
      
      if (!data) throw new Error('No verse returned');
      
      const reference = `Surah ${data.surah.englishName} (${data.surah.number}:${data.numberInSurah})`;
      
      // Also fetch the Arabic text
      let arabicText = '';
      try {
        const arRes = await axios.get(`https://api.alquran.cloud/v1/ayah/${data.surah.number}:${data.numberInSurah}/quran-uthmani`, { timeout: 10000 });
        arabicText = arRes.data?.data?.text || '';
      } catch (e) {}
      
      let text = `QURAN VERSE\n\n${reference}\n\n`;
      if (arabicText) {
        text += `${arabicText}\n\n`;
      }
      text += `${data.text}\n\n${settings.footer}`;
      
      await conn.sendMessage(chatId, { text });
      
    } catch (error) {
      console.log('[QURAN] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, { text: `Failed to fetch verse.\n\n${settings.footer}` });
    }
  }
};