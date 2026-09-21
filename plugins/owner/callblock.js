/**
 * NEXORA MD - Call Block
 * Permanently block a number from calling the bot
 * Usage:
 *   .callblock <number>
 *   .callblock list
 */

const settings = require('../../settings');
const fs = require('fs');

const blockPath = './data/callblocked.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function readBlocked() {
  try {
    if (fs.existsSync(blockPath)) return JSON.parse(fs.readFileSync(blockPath, 'utf8'));
  } catch (e) {}
  return [];
}

function writeBlocked(data) {
  try { fs.writeFileSync(blockPath, JSON.stringify(data, null, 2)); } catch (e) {}
}

function cleanNum(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function isValidNumber(n) {
  return /^[0-9]{8,15}$/.test(n);
}

module.exports = {
  name: 'callblock',
  aliases: ['blockcall'],
  category: 'owner',
  description: 'Block a number from calling the bot',
  usage: '.callblock <number> | .callblock list',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const sub = (args[0] || '').toLowerCase();

      // ─── LIST ───
      if (sub === 'list') {
        const blocked = readBlocked();
        if (blocked.length === 0) {
          await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
          await conn.sendMessage(chatId, {
            text: `No call-blocked numbers.\n\n${settings.footer}`
          });
          return;
        }

        let text = `CALL-BLOCKED NUMBERS\n\n`;
        blocked.forEach((b, i) => {
          text += `${i + 1}. ${b.number} (added ${b.date})\n`;
        });
        text += `\n${settings.footer}`;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, { text });
        return;
      }

      // ─── ADD ───
      if (sub) {
        const num = cleanNum(sub);

        if (!isValidNumber(num)) {
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          await conn.sendMessage(chatId, {
            text: `Invalid number: ${sub}\n\n${settings.footer}`
          });
          return;
        }

        const blocked = readBlocked();
        if (blocked.some(b => b.number === num)) {
          await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
          await conn.sendMessage(chatId, {
            text: `${num} is already call-blocked.\n\n${settings.footer}`
          });
          return;
        }

        // Add to blocked list
        blocked.push({ number: num, date: new Date().toLocaleString() });
        writeBlocked(blocked);

        // Also block via WhatsApp
        try {
          await conn.updateBlockStatus(num + '@s.whatsapp.net', 'block');
        } catch (e) {
          console.log('[CALLBLOCK] WhatsApp block failed:', e.message);
        }

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `CALL-BLOCKED\n\n` +
            `Number: ${num}\n` +
            `Time: ${new Date().toLocaleString()}\n\n` +
            `This number is now blocked from calling the bot.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─── USAGE ───
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `CALL BLOCK\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}callblock <number>\n` +
          `  ${settings.prefix || '.'}callblock list\n\n` +
          `Example:\n` +
          `  ${settings.prefix || '.'}callblock 254711111111\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[CALLBLOCK] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
    }
  }
};