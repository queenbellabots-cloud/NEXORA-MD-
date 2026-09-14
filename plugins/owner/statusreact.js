/**
 * NEXORA MD - Toggle Auto-React to Statuses
 * Persists to data/status.json, seeds emojis on first enable
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/status.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function getDefaultEmojis() {
  return Array.isArray(settings.statusReactionEmojis) && settings.statusReactionEmojis.length > 0
    ? settings.statusReactionEmojis.slice()
    : ['🔥', '❤️', '😍', '👑', '✨', '🌟', '💯', '🎉', '💪', '👏'];
}

function readStore() {
  try {
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return {
        view: data.view !== false,
        react: data.react !== false,
        emojis: Array.isArray(data.emojis) && data.emojis.length > 0 ? data.emojis : getDefaultEmojis()
      };
    }
  } catch (e) {}
  return { view: true, react: true, emojis: getDefaultEmojis() };
}

function writeStore(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('[STATUSREACT] Write failed:', e.message);
  }
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
        if (!Array.isArray(store.emojis) || store.emojis.length === 0) {
          store.emojis = getDefaultEmojis();
        }
        writeStore(store);
        if (global.autoStatusFlags) global.autoStatusFlags.react = true;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Auto-react to statuses: ENABLED\n\n` +
            `Emojis loaded: ${store.emojis.length}\n` +
            `Preview: ${store.emojis.slice(0, 10).join(' ')}\n\n` +
            `Customize with ${settings.prefix || '.'}sremoji\n\n` +
            `${settings.footer}`
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
      const emojiCount = store.emojis.length;

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `AUTO-REACT TO STATUSES\n\n` +
          `Status: ${status}\n` +
          `Emojis: ${emojiCount}\n\n` +
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