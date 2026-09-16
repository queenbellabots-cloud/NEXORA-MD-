/**
 * NEXORA MD - Auto-Typing Toggle
 * Controls the "typing..." presence shown to others
 * Usage:
 *   .autotyping on          → enable all (DM + groups + status)
 *   .autotyping off         → disable all
 *   .autotyping dm on|off   → toggle DM typing only
 *   .autotyping groups on|off → toggle group typing only
 *   .autotyping status on|off → toggle status typing only
 *   .autotyping              → show current state
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/autotyping.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function readStore() {
  try {
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return {
        enabled: data.enabled !== false,
        dm: data.dm !== false,
        groups: data.groups !== false,
        status: data.status !== false
      };
    }
  } catch (e) {}
  return {
    enabled: settings.autoTyping !== false,
    dm: true,
    groups: true,
    status: true
  };
}

function writeStore(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('[AUTOTYPING] Write failed:', e.message);
  }
}

function applyState(store) {
  global.autoTyping = {
    enabled: store.enabled,
    dm: store.dm,
    groups: store.groups,
    status: store.status
  };
}

module.exports = {
  name: 'autotyping',
  aliases: ['at', 'typing'],
  category: 'owner',
  description: 'Toggle auto-typing presence',
  usage: '.autotyping on | off | dm on | groups on | status on',
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
      // ON / OFF (global)
      // ─────────────────────────────────────────
      if (sub === 'on') {
        store.enabled = true;
        writeStore(store);
        applyState(store);
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Auto-typing: ENABLED (all chats)\n\n${settings.footer}`
        });
        return;
      }

      if (sub === 'off') {
        store.enabled = false;
        writeStore(store);
        applyState(store);
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Auto-typing: DISABLED\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // PER-SCOPE (dm / groups / status)
      // ─────────────────────────────────────────
      if (['dm', 'groups', 'group', 'status'].includes(sub) && ['on', 'off'].includes(val)) {
        const key = sub === 'group' ? 'groups' : sub;
        store[key] = val === 'on';
        writeStore(store);
        applyState(store);
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Auto-typing ${key}: ${val.toUpperCase()}\n\n${settings.footer}`
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
          `AUTO-TYPING\n\n` +
          `Global: ${globalStatus}\n` +
          `DM: ${dmStatus}\n` +
          `Groups: ${groupsStatus}\n` +
          `Status: ${statusStatus}\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}autotyping on             - all on\n` +
          `  ${settings.prefix || '.'}autotyping off            - all off\n` +
          `  ${settings.prefix || '.'}autotyping dm on          - DM only\n` +
          `  ${settings.prefix || '.'}autotyping groups on      - groups only\n` +
          `  ${settings.prefix || '.'}autotyping status on      - status only\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[AUTOTYPING] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};