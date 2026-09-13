/**
 * NEXORA MD - Anti-Left Protection
 * Re-adds any member who tries to leave the group
 * Handles JID and LID admin matching
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/antileft.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}));

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeStore(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('[ANTILEFT] Write failed:', e.message);
  }
}

// ─────────────────────────────────────────────
// ID HELPERS (handle JID + LID)
// ─────────────────────────────────────────────
function extractNumber(id) {
  if (!id) return '';
  return String(id).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function extractLidPart(id) {
  if (!id) return '';
  return String(id).split('@')[0];
}

function idsMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;

  const aNum = extractNumber(a);
  const bNum = extractNumber(b);
  const aLid = extractLidPart(a);
  const bLid = extractLidPart(b);

  return (
    (aNum && bNum && aNum === bNum) ||
    (aLid && bLid && aLid === bLid) ||
    (aNum && bLid && aNum === bLid) ||
    (aLid && bNum && aLid === bNum)
  );
}

function getBotIds(conn) {
  const ids = new Set();
  if (!conn || !conn.user) return ids;

  if (conn.user.id) {
    ids.add(conn.user.id);
    ids.add(conn.user.id.split(':')[0] + '@s.whatsapp.net');
    ids.add(conn.user.id.split(':')[0] + '@lid');
  }
  if (conn.user.lid) {
    ids.add(conn.user.lid);
    ids.add(conn.user.lid.split(':')[0] + '@lid');
    ids.add(conn.user.lid.split(':')[0] + '@s.whatsapp.net');
  }
  return ids;
}

function isBotParticipant(participant, botIds) {
  for (const id of botIds) {
    if (idsMatch(participant.id, id)) return true;
    if (participant.lid && idsMatch(participant.lid, id)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────
// ADMIN CHECKS
// ─────────────────────────────────────────────
async function isBotAdmin(conn, groupId) {
  try {
    const meta = await conn.groupMetadata(groupId);
    const botIds = getBotIds(conn);

    const me = meta.participants.find(p => isBotParticipant(p, botIds));
    if (!me) {
      console.log('[ANTILEFT] Bot not found in participant list');
      return false;
    }

    return me.admin === 'admin' || me.admin === 'superadmin';
  } catch (e) {
    console.log('[ANTILEFT] isBotAdmin error:', e.message);
    return false;
  }
}

async function isSenderAdmin(conn, groupId, senderJid) {
  try {
    const meta = await conn.groupMetadata(groupId);
    const me = meta.participants.find(p => {
      if (idsMatch(p.id, senderJid)) return true;
      if (p.lid && idsMatch(p.lid, senderJid)) return true;
      return false;
    });
    if (!me) return false;
    return me.admin === 'admin' || me.admin === 'superadmin';
  } catch (e) {
    return false;
  }
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
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
      try {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
      } catch (e) {}
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

    // Build set of admin JIDs
    const adminIds = meta.participants
      .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
      .map(p => p.id);

    const botIds = getBotIds(conn);

    const toReAdd = [];

    for (const p of participants) {
      const jid = typeof p === 'string' ? p : (p.id || p.jid);
      if (!jid) continue;

      // Skip admins
      if (adminIds.some(a => idsMatch(a, jid))) continue;

      // Skip the bot itself
      let isBot = false;
      for (const id of botIds) {
        if (idsMatch(id, jid)) { isBot = true; break; }
      }
      if (isBot) continue;

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
      const names = toReAdd.map(j => '@' + extractNumber(j)).join(', ');
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