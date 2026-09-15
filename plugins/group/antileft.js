/**
 * NEXORA MD - Anti-Left Protection
 * Re-adds any member who tries to leave the group
 * Uses shared admin helpers (JID + LID safe)
 */

const fs = require('fs');
const settings = require('../../settings');
const { isBotAdmin, idsMatch, cleanNum, extractLidPart } = require('../../lib/groupAdmin');

const dataPath = './data/antileft.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}));

function readStore() {
  try { return JSON.parse(fs.readFileSync(dataPath, 'utf8')); }
  catch (e) { return {}; }
}

function writeStore(data) {
  try { fs.writeFileSync(dataPath, JSON.stringify(data, null, 2)); }
  catch (e) { console.log('[ANTILEFT] Write failed:', e.message); }
}

async function isSenderAdmin(conn, groupId, senderJid) {
  try {
    const meta = await conn.groupMetadata(groupId);
    const me = meta.participants.find(p =>
      idsMatch(p.id, senderJid) || (p.lid && idsMatch(p.lid, senderJid))
    );
    if (!me) return false;
    return me.admin === 'admin' || me.admin === 'superadmin';
  } catch (e) {
    return false;
  }
}

module.exports = {
  name: 'antileft',
  aliases: ['al', 'antiexit'],
  category: 'group',
  description: 'Prevent members from leaving the group',
  usage: '.antileft on | .antileft off',
  groupOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const isGroup = chatId.endsWith('@g.us');
      if (!isGroup) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, { text: `This command is for groups only.\n\n${settings.footer}` });
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

      if (choice === 'on') {
        store[chatId] = { enabled: true };
        writeStore(store);
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `ANTI-LEFT ENABLED\n\n` +
            `Members who try to leave this group will be re-added automatically.\n` +
            `Admins can still leave.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      if (choice === 'off') {
        store[chatId] = { enabled: false };
        writeStore(store);
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `ANTI-LEFT DISABLED\n\n` +
            `Members can now leave freely.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const current = store[chatId];
      const status = current?.enabled ? 'ENABLED' : 'DISABLED';

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `ANTI-LEFT PROTECTION\n\n` +
          `Status: ${status}\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}antileft on   - prevent leaves\n` +
          `  ${settings.prefix || '.'}antileft off  - allow leaves\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[ANTILEFT] Command error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};

// ─────────────────────────────────────────────
// WATCHER - called from main.js
// ─────────────────────────────────────────────
async function antiLeftWatcher(conn, update) {
  try {
    const { id: groupId, participants, action } = update;

    if (!groupId || !groupId.endsWith('@g.us')) return;
    if (action !== 'remove') return;

    const store = readStore();
    if (!store[groupId] || !store[groupId].enabled) return;

    const botIsAdmin = await isBotAdmin(conn, groupId);
    if (!botIsAdmin) {
      console.log('[ANTILEFT] Bot not admin in', groupId, '- skipping');
      return;
    }

    let meta = null;
    try {
      meta = await conn.groupMetadata(groupId);
    } catch (e) {
      console.log('[ANTILEFT] Metadata fetch failed:', e.message);
      return;
    }

    // Build list of admin IDs (JID + LID)
    const adminIds = [];
    for (const p of meta.participants) {
      if (p.admin === 'admin' || p.admin === 'superadmin') {
        adminIds.push(p.id);
        if (p.lid) adminIds.push(p.lid);
      }
    }

    // Bot's own IDs
    const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
    const botLid = conn.user.lid ? extractLidPart(conn.user.lid) : '';

    const toReAdd = [];

    for (const p of participants) {
      const jid = typeof p === 'string' ? p : (p.id || p.jid);
      if (!jid) continue;

      // Skip admins
      if (adminIds.some(a => idsMatch(a, jid))) continue;

      // Skip the bot itself
      if (idsMatch(botJid, jid)) continue;
      if (botLid && idsMatch(botLid, jid)) continue;

      toReAdd.push(jid);
    }

    if (toReAdd.length === 0) return;

    try {
      await conn.groupParticipantsUpdate(groupId, toReAdd, 'add');
      console.log('[ANTILEFT] Re-added:', toReAdd.join(', '));
    } catch (e) {
      console.log('[ANTILEFT] Re-add failed:', e.message);
      return;
    }

    try {
      const names = toReAdd.map(j => '@' + cleanNum(j)).join(', ');
      await conn.sendMessage(groupId, {
        text:
          `ANTI-LEFT\n\n` +
          `${names} tried to leave and was re-added.\n\n` +
          `${settings.footer}`,
        mentions: toReAdd
      });
    } catch (e) {}

  } catch (error) {
    console.log('[ANTILEFT] Watcher error:', error.message);
  }
}

module.exports.antiLeftWatcher = antiLeftWatcher;