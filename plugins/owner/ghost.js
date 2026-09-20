/**
 * NEXORA MD - Ghost Mode
 * Disables read receipts (blue ticks) — recipients only see 1 tick
 * Note: group chats are not affected by this setting
 * Usage:
 *   .ghost on   → disable read receipts
 *   .ghost off  → enable read receipts
 *   .ghost      → show current status
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/ghost.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function readStore() {
  try {
    if (fs.existsSync(dataPath)) return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch (e) {}
  return { enabled: false };
}

function writeStore(data) {
  try { fs.writeFileSync(dataPath, JSON.stringify(data, null, 2)); } catch (e) {}
}

module.exports = {
  name: 'ghost',
  aliases: ['ghostmode', 'stealth'],
  category: 'owner',
  description: 'Hide read receipts (only 1 tick shown to senders)',
  usage: '.ghost on | .ghost off',
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
        await conn.updateReadReceiptsPrivacy('none');
        store.enabled = true;
        writeStore(store);
        global.ghostMode = true;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `GHOST MODE ENABLED\n\n` +
            `The bot will no longer send read receipts.\n` +
            `Senders will only see 1 grey tick — never "read".\n\n` +
            `Note: group chats are not affected by this.\n` +
            `Voice note "played" receipts also still fire.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      if (choice === 'off') {
        await conn.updateReadReceiptsPrivacy('all');
        store.enabled = false;
        writeStore(store);
        global.ghostMode = false;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `GHOST MODE DISABLED\n\nRead receipts are back to normal.\n\n${settings.footer}`
        });
        return;
      }

      const status = store.enabled ? 'ENABLED' : 'DISABLED';
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `GHOST MODE\n\n` +
          `Status: ${status}\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}ghost on   - hide read receipts\n` +
          `  ${settings.prefix || '.'}ghost off  - restore read receipts\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[GHOST] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};