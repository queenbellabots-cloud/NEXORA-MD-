/**
 * NEXORA MD - Always Online Toggle
 * Controls whether bot stays "online" in WhatsApp
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/alwaysonline.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function readStore() {
  try {
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
  } catch (e) {}
  return { enabled: settings.alwaysOnline !== false };
}

function writeStore(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('[ALWAYSONLINE] Write failed:', e.message);
  }
}

module.exports = {
  name: 'alwaysonline',
  aliases: ['ao', 'stayonline', 'online'],
  category: 'owner',
  description: 'Toggle always-online presence',
  usage: '.alwaysonline on | .alwaysonline off',
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
        global.alwaysOnline = true;

        try {
          await conn.sendPresenceUpdate('available');
        } catch (e) {}

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `ALWAYS ONLINE ENABLED\n\n` +
            `Bot will stay online in WhatsApp.\n\n` +
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
        global.alwaysOnline = false;

        try {
          await conn.sendPresenceUpdate('unavailable');
        } catch (e) {}

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `ALWAYS ONLINE DISABLED\n\n` +
            `Bot will follow normal WhatsApp presence.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // STATUS
      // ─────────────────────────────────────────
      const status = store.enabled ? 'ENABLED' : 'DISABLED';

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `ALWAYS ONLINE\n\n` +
          `Status: ${status}\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}alwaysonline on   - stay online\n` +
          `  ${settings.prefix || '.'}alwaysonline off  - normal presence\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[ALWAYSONLINE] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};