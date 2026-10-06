/**
 * NEXORA MD - Remind
 * Set a reminder — bot pings you at the specified time
 * Usage:
 *   .remind 30m Call mum
 *   .remind 2h Check the oven
 *   .remind 1d Renew subscription
 */

const settings = require('../../settings');

function parseTime(str) {
  const match = String(str).match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * multipliers[unit];
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

module.exports = {
  name: 'remind',
  aliases: ['reminder', 'timer'],
  category: 'general',
  description: 'Set a reminder',
  usage: '.remind <time> <message>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (args.length < 2) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Set a reminder\n\n` +
            `Usage: ${settings.prefix || '.'}remind <time> <message>\n\n` +
            `Time units: s, m, h, d\n\n` +
            `Examples:\n` +
            `  ${settings.prefix || '.'}remind 30m Call mum\n` +
            `  ${settings.prefix || '.'}remind 2h Check the oven\n` +
            `  ${settings.prefix || '.'}remind 1d Renew subscription\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const timeMs = parseTime(args[0]);
      if (!timeMs) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Invalid time format. Use: 30s, 5m, 2h, 1d\n\n${settings.footer}`
        });
        return;
      }

      if (timeMs > 7 * 86400000) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Maximum reminder time is 7 days.\n\n${settings.footer}`
        });
        return;
      }

      const message = args.slice(1).join(' ').trim();
      const sender = mek.key.participant || mek.key.remoteJid;

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `REMINDER SET\n\n` +
          `Time: ${formatDuration(timeMs)}\n` +
          `Message: ${message}\n\n` +
          `${settings.footer}`
      });

      setTimeout(async () => {
        try {
          await conn.sendMessage(chatId, {
            text: `REMINDER\n\n${message}`,
            mentions: [sender]
          });
        } catch (e) {
          console.log('[REMIND] Send failed:', e.message);
        }
      }, timeMs);

    } catch (error) {
      console.log('[REMIND] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
    }
  }
};