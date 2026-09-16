/**
 * NEXORA MD - Anti-Edit (DM only)
 * Detects edited messages in DMs and notifies the owner
 * Usage:
 *   .antiedit on
 *   .antiedit off
 *   .antiedit
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/antiedit.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function readStore() {
  try {
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
  } catch (e) {}
  return { enabled: false };
}

function writeStore(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('[ANTIEDIT] Write failed:', e.message);
  }
}

module.exports = {
  name: 'antiedit',
  aliases: ['ae', 'edited'],
  category: 'owner',
  description: 'Detect edited messages in DMs',
  usage: '.antiedit on | .antiedit off',
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
        global.antiEdit = true;
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `ANTI-EDIT ENABLED (DM only)\n\n` +
            `Edited messages in DMs will be forwarded to your DM with the original text.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      if (choice === 'off') {
        store.enabled = false;
        writeStore(store);
        global.antiEdit = false;
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `ANTI-EDIT DISABLED\n\n${settings.footer}`
        });
        return;
      }

      const status = store.enabled ? 'ENABLED' : 'DISABLED';
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `ANTI-EDIT (DM)\n\n` +
          `Status: ${status}\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}antiedit on   - enable\n` +
          `  ${settings.prefix || '.'}antiedit off  - disable\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[ANTIEDIT] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};