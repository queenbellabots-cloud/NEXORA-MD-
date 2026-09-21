/**
 * NEXORA MD - Anti-Call
 * Rejects incoming calls and sends a polite warning (does NOT block)
 * Usage:
 *   .anticall on
 *   .anticall off
 *   .anticall
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/anticall.json';
const logPath = './data/call_log.json';
const msgPath = './data/call_messages.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function readStore() {
  try {
    if (fs.existsSync(dataPath)) return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch (e) {}
  return { enabled: true };
}

function writeStore(data) {
  try { fs.writeFileSync(dataPath, JSON.stringify(data, null, 2)); } catch (e) {}
}

module.exports = {
  name: 'anticall',
  aliases: ['ac', 'nocall'],
  category: 'owner',
  description: 'Reject calls and send a polite warning (no block)',
  usage: '.anticall on | .anticall off',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const store = readStore();
      const choice = (args[0] || '').toLowerCase();

      if (choice === 'on') {
        store.enabled = true;
        writeStore(store);
        global.antiCall = true;
        global.antiCallBlock = false;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `ANTI-CALL ENABLED\n\n` +
            `Mode: Polite warning (does NOT block)\n` +
            `Callers receive a polite message, then the call is rejected.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      if (choice === 'off') {
        store.enabled = false;
        writeStore(store);
        global.antiCall = false;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `ANTI-CALL DISABLED\n\nCallers can now reach the bot.\n\n${settings.footer}`
        });
        return;
      }

      const status = store.enabled ? 'ENABLED' : 'DISABLED';
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `ANTI-CALL\n\n` +
          `Status: ${status}\n` +
          `Mode: Polite warning (no block)\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}anticall on\n` +
          `  ${settings.prefix || '.'}anticall off\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[ANTICALL] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
    }
  }
};