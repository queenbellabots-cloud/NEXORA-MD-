/**
 * NEXORA MD - Toggle Auto-View Statuses
 * Usage: .statusview on | .statusview off
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/status.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({ view: true, react: true }));

function readStore() {
  try { return JSON.parse(fs.readFileSync(dataPath, 'utf8')); }
  catch (e) { return { view: true, react: true }; }
}

function writeStore(data) {
  try { fs.writeFileSync(dataPath, JSON.stringify(data, null, 2)); }
  catch (e) { console.log('[STATUSVIEW] Write failed:', e.message); }
}

module.exports = {
  name: 'statusview',
  aliases: ['autoview', 'viewstatus'],
  category: 'owner',
  description: 'Toggle auto-viewing of WhatsApp statuses',
  usage: '.statusview on | .statusview off',
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
        store.view = true;
        writeStore(store);
        global.autoStatusFlags.seen = true;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Auto-view statuses: ENABLED\n\n${settings.footer}`
        });
        return;
      }

      if (choice === 'off') {
        store.view = false;
        writeStore(store);
        global.autoStatusFlags.seen = false;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Auto-view statuses: DISABLED\n\n${settings.footer}`
        });
        return;
      }

      const status = store.view ? 'ENABLED' : 'DISABLED';
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `AUTO-VIEW STATUSES\n\n` +
          `Status: ${status}\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}statusview on\n` +
          `  ${settings.prefix || '.'}statusview off\n\n` +
          `${settings.footer}`
      });
    } catch (error) {
      console.log('[STATUSVIEW] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
    }
  }
};