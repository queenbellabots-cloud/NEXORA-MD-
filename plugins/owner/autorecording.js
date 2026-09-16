/**
 * NEXORA MD - Auto-Recording Toggle
 * Controls the "recording audio..." presence shown to others
 * Usage:
 *   .autorecording on          → enable all
 *   .autorecording off         → disable all
 *   .autorecording dm on|off   → DM only
 *   .autorecording groups on|off → groups only
 *   .autorecording status on|off → status only
 *   .autorecording             → show state
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/autorecording.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function readStore() {
  try {
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return {
        enabled: data.enabled === true,
        dm: data.dm !== false,
        groups: data.groups !== false,
        status: data.status !== false
      };
    }
  } catch (e) {}
  return { enabled: false, dm: true, groups: true, status: true };
}

function writeStore(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('[AUTORECORDING] Write failed:', e.message);
  }
}

function applyState(store) {
  global.autoRecording = {
    enabled: store.enabled,
    dm: store.dm,
    groups: store.groups,
    status: store.status
  };
}

module.exports = {
  name: 'autorecording',
  aliases: ['ar', 'recording'],
  category: 'owner',
  description: 'Toggle auto-recording presence',
  usage: '.autorecording on | off | dm on | groups on | status on',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const store = readStore();
      const sub = (args[0] || '').toLowerCase();
      const val = (args[1] || '').toLowerCase();

      // ─────────────────────────────────────────
      // ON / OFF
      // ─────────────────────────────────────────
      if (sub === 'on') {
        store.enabled = true;
        writeStore(store);
        applyState(store);
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Auto-recording: ENABLED (all chats)\n\n${settings.footer}`
        });
        return;
      }

      if (sub === 'off') {
        store.enabled = false;
        writeStore(store);
        applyState(store);
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Auto-recording: DISABLED\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // PER-SCOPE
      // ─────────────────────────────────────────
      if (['dm', 'groups', 'group', 'status'].includes(sub) && ['on', 'off'].includes(val)) {
        const key = sub === 'group' ? 'groups' : sub;
        store[key] = val === 'on';
        writeStore(store);
        applyState(store);
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Auto-recording ${key}: ${val.toUpperCase()}\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // STATUS
      // ─────────────────────────────────────────
      const globalStatus = store.enabled ? 'ENABLED' : 'DISABLED';
      const dmStatus = store.dm ? 'ON' : 'OFF';
      const groupsStatus = store.groups ? 'ON' : 'OFF';
      const statusStatus = store.status ? 'ON' : 'OFF';

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `AUTO-RECORDING\n\n` +
          `Global: ${globalStatus}\n` +
          `DM: ${dmStatus}\n` +
          `Groups: ${groupsStatus}\n` +
          `Status: ${statusStatus}\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}autorecording on          - all on\n` +
          `  ${settings.prefix || '.'}autorecording off         - all off\n` +
          `  ${settings.prefix || '.'}autorecording dm on       - DM only\n` +
          `  ${settings.prefix || '.'}autorecording groups on   - groups only\n` +
          `  ${settings.prefix || '.'}autorecording status on   - status only\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[AUTORECORDING] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};