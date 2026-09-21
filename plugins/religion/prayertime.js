/**
 * NEXORA MD - Prayer Times
 * Fetches daily prayer times for a city using Aladhan API (no key)
 * Usage: .prayertime <city> <country>
 */

const settings = require('../../settings');
const axios = require('axios');

module.exports = {
  name: 'prayertime',
  aliases: ['salah', 'namaz'],
  category: 'religion',
  description: 'Get daily prayer times for a city',
  usage: '.prayertime <city> <country>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (args.length < 2) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Usage: ${settings.prefix || '.'}prayertime <city> <country>\nExample: ${settings.prefix || '.'}prayertime Nairobi Kenya\n\n${settings.footer}`
        });
        return;
      }

      const city = args[0];
      const country = args.slice(1).join(' ');

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=2`;
      const res = await axios.get(url, { timeout: 15000 });

      const timings = res.data?.data?.timings;
      if (!timings) throw new Error('No timings returned');

      const text =
        `PRAYER TIMES\n\n` +
        `Location: ${city}, ${country}\n` +
        `Date: ${res.data.data.date.readable}\n\n` +
        `Fajr:    ${timings.Fajr}\n` +
        `Dhuhr:   ${timings.Dhuhr}\n` +
        `Asr:     ${timings.Asr}\n` +
        `Maghrib: ${timings.Maghrib}\n` +
        `Isha:    ${timings.Isha}\n\n` +
        `${settings.footer}`;

      await conn.sendMessage(chatId, { text });
    } catch (error) {
      console.log('[PRAYERTIME] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, { text: `Failed to fetch prayer times.\n\n${settings.footer}` });
    }
  }
};