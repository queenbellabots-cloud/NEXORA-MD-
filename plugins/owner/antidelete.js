/**
 * NEXORA MD - Anti-Delete Toggle
 * Owner-only command to enable/disable anti-delete protection
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/antidelete.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function readStore() {
  try {
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
  } catch (e) {}
  return { enabled: settings.antiDelete !== false };
}

function writeStore(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('[ANTIDELETE] Write failed:', e.message);
  }
}

function applyState(enabled) {
  global.antiDelete = enabled;
}

module.exports = {
  name: 'antidelete',
  aliases: ['ad', 'antidel'],
  category: 'owner',
  description: 'Enable or disable anti-delete protection',
  usage: '.antidelete on | .antidelete off',
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

      // ─────────────────────────────────────────
      // ON
      // ─────────────────────────────────────────
      if (choice === 'on') {
        store.enabled = true;
        writeStore(store);
        applyState(true);

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `ANTI-DELETE ENABLED\n\n` +
            `Deleted messages will be recovered and sent to your DM.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // OFF
      // ─────────────────────────────────────────
      if (choice === 'off') {
        store.enabled = false;
        writeStore(store);
        applyState(false);

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `ANTI-DELETE DISABLED\n\n` +
            `Deleted messages will no longer be recovered.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // STATUS
      // ─────────────────────────────────────────
      const current = store.enabled ? 'ENABLED' : 'DISABLED';

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `ANTI-DELETE PROTECTION\n\n` +
          `Status: ${current}\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}antidelete on   - enable\n` +
          `  ${settings.prefix || '.'}antidelete off  - disable\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[ANTIDELETE] Error:', error.message);
      try {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
      } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};