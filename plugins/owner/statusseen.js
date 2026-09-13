/**
 * NEXORA MD - Show Status Settings
 * Usage: .statusseen
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/status.json';

function readStore() {
  try {
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
  } catch (e) {}
  return { view: true, react: true };
}

module.exports = {
  name: 'statusseen',
  aliases: ['statussettings', 'statusinfo'],
  category: 'owner',
  description: 'Show current status automation settings',
  usage: '.statusseen',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const store = readStore();
      const viewStatus = store.view ? 'ENABLED' : 'DISABLED';
      const reactStatus = store.react ? 'ENABLED' : 'DISABLED';

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `STATUS SETTINGS\n\n` +
          `Auto-view: ${viewStatus}\n` +
          `Auto-react: ${reactStatus}\n\n` +
          `Toggle commands:\n` +
          `  ${settings.prefix || '.'}statusview on|off\n` +
          `  ${settings.prefix || '.'}statusreact on|off\n\n` +
          `${settings.footer}`
      });
    } catch (error) {
      console.log('[STATUSSEEN] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
    }
  }
};