/**
 * NEXORA MD - AFK
 * Set yourself as away. Bot auto-replies to mentions/DMs.
 * Usage:
 *   .afk <reason>
 *   .afk off
 *   .afk
 */

const settings = require('../../settings');
const fs = require('fs');

const dataPath = './data/afk.json';
if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function readStore() {
  try {
    if (fs.existsSync(dataPath)) return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch (e) {}
  return {};
}

function writeStore(data) {
  try { fs.writeFileSync(dataPath, JSON.stringify(data, null, 2)); } catch (e) {}
}

function cleanNum(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

module.exports = {
  name: 'afk',
  aliases: ['away'],
  category: 'general',
  description: 'Set yourself as AFK',
  usage: '.afk <reason> | .afk off',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const sender = mek.key.participant || mek.key.remoteJid;
      const senderNum = cleanNum(sender);
      const store = readStore();
      const choice = args.join(' ').trim();

      if (choice.toLowerCase() === 'off') {
        if (store[senderNum]) {
          delete store[senderNum];
          writeStore(store);
          await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
          await conn.sendMessage(chatId, {
            text: `AFK removed. Welcome back.\n\n${settings.footer}`
          });
        } else {
          await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
          await conn.sendMessage(chatId, {
            text: `You weren't AFK.\n\n${settings.footer}`
          });
        }
        return;
      }

      if (choice) {
        store[senderNum] = {
          reason: choice,
          time: new Date().toLocaleString()
        };
        writeStore(store);
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `AFK SET\n\n` +
            `Reason: ${choice}\n` +
            `Time: ${new Date().toLocaleString()}\n\n` +
            `Bot will auto-reply when someone mentions you.\n` +
            `Send any message to clear.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // Status
      const current = store[senderNum];
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: current
          ? `You are AFK\nReason: ${current.reason}\nSince: ${current.time}\n\n${settings.footer}`
          : `You are not AFK.\n\nUsage: ${settings.prefix || '.'}afk <reason>\n\n${settings.footer}`
      });

    } catch (error) {
      console.log('[AFK] Error:', error.message);
    }
  }
};