/**
 * NEXORA MD - Hijri Date
 * Converts today's Gregorian date to Hijri (no key)
 * Usage: .hijri
 */

const settings = require('../../settings');
const axios = require('axios');

module.exports = {
  name: 'hijri',
  aliases: ['islamicdate'],
  category: 'religion',
  description: 'Get current Hijri date',
  usage: '.hijri',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();

      const url = `https://api.aladhan.com/v1/gToH?date=${d}-${m}-${y}`;
      const res = await axios.get(url, { timeout: 15000 });

      const hijri = res.data?.data?.hijri;
      if (!hijri) throw new Error('No date returned');

      await conn.sendMessage(chatId, {
        text:
          `HIJRI DATE\n\n` +
          `Gregorian: ${res.data.data.gregorian.date}\n` +
          `Hijri: ${hijri.day} ${hijri.month.en} ${hijri.year} AH\n` +
          `Day: ${hijri.weekday.en}\n\n` +
          `${settings.footer}`
      });
    } catch (error) {
      console.log('[HIJRI] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, { text: `Failed to fetch Hijri date.\n\n${settings.footer}` });
    }
  }
};