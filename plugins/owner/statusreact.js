/**
 * NEXORA MD - Toggle Auto-React to Statuses
 * Persists to data/status.json
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/status.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function readStore() {
  try {
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return { view: data.view !== false, react: data.react !== false, emojis: data.emojis || [] };
    }
  } catch (e) {}
  return { view: true, react: true, emojis: [] };
}

function writeStore(data) {
  try { fs.writeFileSync(dataPath, JSON.stringify(data, null, 2)); }
  catch (e) { console.log('[STATUSREACT] Write failed:', e.message); }
}

module.exports = {
  name: 'statusreact',
  aliases: ['autoreact', 'reactstatus'],
  category: 'owner',
  description: 'Toggle auto-reacting to WhatsApp statuses',
  usage: '.statusreact on | .statusreact off',
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
        store.react = true;
        writeStore(store);
        if (global.autoStatusFlags) global.autoStatusFlags.react = true;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Auto-react to statuses: ENABLED\n\n${settings.footer}`
        });
        return;
      }

      if (choice === 'off') {
        store.react = false;
        writeStore(store);
        if (global.autoStatusFlags) global.autoStatusFlags.react = false;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Auto-react to statuses: DISABLED\n\n${settings.footer}`
        });
        return;
      }

      const status = store.react ? 'ENABLED' : 'DISABLED';
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `AUTO-REACT TO STATUSES\n\n` +
          `Status: ${status}\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}statusreact on\n` +
          `  ${settings.prefix || '.'}statusreact off\n` +
          `  ${settings.prefix || '.'}sremoji 😀,❤️,🔥   - set emojis\n\n` +
          `${settings.footer}`
      });
    } catch (error) {
      console.log('[STATUSREACT] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
    }
  }
};