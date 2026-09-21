/**
 * NEXORA MD - Call History
 * Shows log of rejected calls
 * Usage:
 *   .callhistory [count]
 */

const settings = require('../../settings');
const fs = require('fs');

const logPath = './data/call_log.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function readLog() {
  try {
    if (fs.existsSync(logPath)) return JSON.parse(fs.readFileSync(logPath, 'utf8'));
  } catch (e) {}
  return [];
}

module.exports = {
  name: 'callhistory',
  aliases: ['calllog', 'calls'],
  category: 'owner',
  description: 'Show recent call log',
  usage: '.callhistory [count]',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const limit = Math.min(parseInt(args[0]) || 10, 50);
      const log = readLog();

      if (log.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `No calls logged yet.\n\n${settings.footer}`
        });
        return;
      }

      const recent = log.slice(-limit).reverse();

      let text = `CALL LOG (last ${recent.length})\n\n`;
      recent.forEach((c, i) => {
        text += `${i + 1}. ${c.number}\n`;
        text += `   Name: ${c.name}\n`;
        text += `   Time: ${c.time}\n`;
        text += `   Action: ${c.action || 'rejected'}\n\n`;
      });
      text += `${settings.footer}`;

      if (text.length > 4000) {
        text = text.slice(0, 3990) + '...\n\n' + settings.footer;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text });

    } catch (error) {
      console.log('[CALLHISTORY] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
    }
  }
};