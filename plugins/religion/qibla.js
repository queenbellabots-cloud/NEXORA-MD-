/**
 * NEXORA MD - Qibla Direction
 * Finds the bearing to Mecca from coordinates (no key)
 * Usage: .qibla <latitude> <longitude>
 */

const settings = require('../../settings');
const axios = require('axios');

module.exports = {
  name: 'qibla',
  aliases: ['qiblah'],
  category: 'religion',
  description: 'Get Qibla direction from coordinates',
  usage: '.qibla <latitude> <longitude>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (args.length < 2) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Usage: ${settings.prefix || '.'}qibla <latitude> <longitude>\nExample: ${settings.prefix || '.'}qibla -1.2921 36.8219\n\n${settings.footer}`
        });
        return;
      }

      const lat = parseFloat(args[0]);
      const lon = parseFloat(args[1]);

      if (isNaN(lat) || isNaN(lon)) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, { text: `Invalid coordinates.\n\n${settings.footer}` });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      const url = `https://api.aladhan.com/v1/qibla/${lat}/${lon}`;
      const res = await axios.get(url, { timeout: 15000 });

      const direction = res.data?.data?.direction;
      if (direction === undefined) throw new Error('No direction returned');

      await conn.sendMessage(chatId, {
        text: `QIBLA DIRECTION\n\nCoordinates: ${lat}, ${lon}\nDirection: ${direction}° from true north\n\n${settings.footer}`
      });
    } catch (error) {
      console.log('[QIBLA] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, { text: `Failed to calculate Qibla.\n\n${settings.footer}` });
    }
  }
};