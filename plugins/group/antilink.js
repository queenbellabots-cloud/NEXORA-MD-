/**
 * NEXORA MD - Anti-Link Protection
 * Deletes WhatsApp group invite links and takes action
 * Usage: .antilink on [delete|warn|kick]  |  .antilink off  |  .antilink
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/antilink.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}));

function readStore() {
  try { return JSON.parse(fs.readFileSync(dataPath, 'utf8')); }
  catch (e) { return {}; }
}

function writeStore(data) {
  try { fs.writeFileSync(dataPath, JSON.stringify(data, null, 2)); }
  catch (e) { console.log('[ANTILINK] Write failed:', e.message); }
}

function cleanNum(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

async function isSenderAdmin(conn, groupId, senderJid) {
  try {
    const meta = await conn.groupMetadata(groupId);
    const me = meta.participants.find(p => cleanNum(p.id) === cleanNum(senderJid));
    if (!me) return false;
    return me.admin === 'admin' || me.admin === 'superadmin';
  } catch (e) { return false; }
}

async function isBotAdmin(conn, groupId) {
  try {
    const meta = await conn.groupMetadata(groupId);
    const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
    const me = meta.participants.find(p => cleanNum(p.id) === cleanNum(botJid));
    if (!me) return false;
    return me.admin === 'admin' || me.admin === 'superadmin';
  } catch (e) { return false; }
}

// Regex to catch WhatsApp group invite links
function detectLink(text) {
  if (!text) return false;
  const patterns = [
    /chat\.whatsapp\.com\/[A-Za-z0-9]{10,}/i,
    /whatsapp\.com\/channel\/[A-Za-z0-9]{10,}/i,
    /wa\.me\/[0-9]+/i,
    /t\.me\/[A-Za-z0-9_]+/i,
    /telegram\.me\/[A-Za-z0-9_]+/i
  ];
  return patterns.some(re => re.test(text));
}

// ═══════════════════════════════════════════════════════
// COMMAND
// ═══════════════════════════════════════════════════════
module.exports = {
  name: 'antilink',
  aliases: ['al', 'nolink', 'antilinks'],
  category: 'group',
  description: 'Delete group invite links automatically',
  usage: '.antilink on [delete|warn|kick] | .antilink off',
  groupOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const isGroup = chatId.endsWith('@g.us');
      if (!isGroup) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const sender = mek.key.participant || mek.key.remoteJid;
      const senderIsAdmin = await isSenderAdmin(conn, chatId, sender);

      if (!senderIsAdmin && !isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Admin or owner access required.\n\n${settings.footer}`
        });
        return;
      }

      const botIsAdmin = await isBotAdmin(conn, chatId);
      if (!botIsAdmin) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `I need to be an admin to use this feature.\n\n${settings.footer}`
        });
        return;
      }

      const store = readStore();
      const choice = (args[0] || '').toLowerCase();
      const action = (args[1] || 'delete').toLowerCase();

      // ─────────────────────────────────────────
      // ON
      // ─────────────────────────────────────────
      if (choice === 'on') {
        const validAction = ['delete', 'warn', 'kick'].includes(action) ? action : 'delete';
        store[chatId] = { enabled: true, action: validAction };
        writeStore(store);

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `ANTI-LINK ENABLED\n\n` +
            `Action: ${validAction.toUpperCase()}\n\n` +
            `Links will be deleted. Offenders will be:\n` +
            `  delete - message removed\n` +
            `  warn   - warned\n` +
            `  kick   - removed from group\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // OFF
      // ─────────────────────────────────────────
      if (choice === 'off') {
        store[chatId] = { enabled: false };
        writeStore(store);

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `ANTI-LINK DISABLED\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // STATUS
      // ─────────────────────────────────────────
      const current = store[chatId];
      const status = current?.enabled ? 'ENABLED' : 'DISABLED';
      const currentAction = current?.action || 'delete';

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `ANTI-LINK PROTECTION\n\n` +
          `Status: ${status}\n` +
          `Action: ${currentAction.toUpperCase()}\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}antilink on delete\n` +
          `  ${settings.prefix || '.'}antilink on warn\n` +
          `  ${settings.prefix || '.'}antilink on kick\n` +
          `  ${settings.prefix || '.'}antilink off\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[ANTILINK] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};

// ═══════════════════════════════════════════════════════
// WATCHER - called from main.js
// ═══════════════════════════════════════════════════════
async function antiLinkWatcher(conn, mek, chatId) {
  try {
    if (!chatId || !chatId.endsWith('@g.us')) return;

    const store = readStore();
    const config = store[chatId];
    if (!config || !config.enabled) return;

    // Skip admins and owner
    const sender = mek.key.participant || mek.key.remoteJid;
    const senderIsAdmin = await isSenderAdmin(conn, chatId, sender);
    if (senderIsAdmin) return;

    const botIsAdmin = await isBotAdmin(conn, chatId);
    if (!botIsAdmin) return;

    // Extract text from message
    let text = '';
    const msg = mek.message || {};
    if (msg.conversation) text = msg.conversation;
    else if (msg.extendedTextMessage) text = msg.extendedTextMessage.text;
    else if (msg.imageMessage) text = msg.imageMessage.caption || '';
    else if (msg.videoMessage) text = msg.videoMessage.caption || '';
    else if (msg.documentMessage) text = msg.documentMessage.caption || '';

    if (!text) return;
    if (!detectLink(text)) return;

    // Delete the message
    try {
      await conn.sendMessage(chatId, { delete: mek.key });
      console.log('[ANTILINK] Deleted link from', cleanNum(sender));
    } catch (e) {
      console.log('[ANTILINK] Delete failed:', e.message);
    }

    const action = config.action || 'delete';
    const mention = ['@' + cleanNum(sender)];

    // Warn
    if (action === 'warn') {
      try {
        await conn.sendMessage(chatId, {
          text:
            `ANTI-LINK\n\n` +
            `@${cleanNum(sender)}, group invite links are not allowed.\n\n` +
            `${settings.footer}`,
          mentions: [sender]
        });
      } catch (e) {}
    }

    // Kick
    if (action === 'kick') {
      try {
        await conn.groupParticipantsUpdate(chatId, [sender], 'remove');
        await conn.sendMessage(chatId, {
          text:
            `ANTI-LINK\n\n` +
            `@${cleanNum(sender)} was removed for posting an invite link.\n\n` +
            `${settings.footer}`,
          mentions: [sender]
        });
      } catch (e) {
        console.log('[ANTILINK] Kick failed:', e.message);
      }
    }
  } catch (error) {
    console.log('[ANTILINK] Watcher error:', error.message);
  }
}

module.exports.antiLinkWatcher = antiLinkWatcher;