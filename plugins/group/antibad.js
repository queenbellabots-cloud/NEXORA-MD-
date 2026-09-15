const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/antibad.json';
if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, '{}');

function readStore() { try { return JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (e) { return {}; } }
function writeStore(d) { try { fs.writeFileSync(dataPath, JSON.stringify(d, null, 2)); } catch (e) {} }
function cleanNum(s) { return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, ''); }

const BAD_WORDS = [
  'fuck', 'fck', 'fuk', 'shit', 'bitch', 'bastard',
  'asshole', 'dick', 'pussy', 'cunt', 'whore', 'slut',
  'malaya', 'kuma', 'mkundu', 'shenzi', 'mjinga',
  'sex', 'porn', 'nude', 'xxx', 'umbwa', 'useless', 'takataka', 'nitakudinya', 'nitakupiga', 'matako'
];

async function isSenderAdmin(conn, groupId, jid) {
  try {
    const meta = await conn.groupMetadata(groupId);
    const me = meta.participants.find(p => cleanNum(p.id) === cleanNum(jid));
    return me && (me.admin === 'admin' || me.admin === 'superadmin');
  } catch (e) { return false; }
}

async function isBotAdmin(conn, groupId) {
  try {
    const meta = await conn.groupMetadata(groupId);
    const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
    const me = meta.participants.find(p => cleanNum(p.id) === cleanNum(botJid));
    return me && (me.admin === 'admin' || me.admin === 'superadmin');
  } catch (e) { return false; }
}

function hasBadWord(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BAD_WORDS.some(w => {
    const re = new RegExp(`(^|[^a-z])${w}([^a-z]|$)`, 'i');
    return re.test(lower);
  });
}

module.exports = {
  name: 'antibad',
  aliases: ['ab', 'badword', 'antibadword'],
  category: 'group',
  description: 'Delete messages with bad words',
  usage: '.antibad on [delete|warn|kick] | .antibad off',
  groupOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!chatId.endsWith('@g.us')) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const sender = mek.key.participant || mek.key.remoteJid;
      const senderIsAdmin = await isSenderAdmin(conn, chatId, sender);

      if (!senderIsAdmin && !isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      if (!(await isBotAdmin(conn, chatId))) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, { text: `I need to be an admin.\n\n${settings.footer}` });
        return;
      }

      const store = readStore();
      const choice = (args[0] || '').toLowerCase();
      const action = ['delete', 'warn', 'kick'].includes((args[1] || '').toLowerCase())
        ? (args[1] || '').toLowerCase()
        : 'delete';

      if (choice === 'on') {
        store[chatId] = { enabled: true, action };
        writeStore(store);
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Anti-bad ENABLED\nAction: ${action.toUpperCase()}\n\n${settings.footer}`
        });
        return;
      }

      if (choice === 'off') {
        store[chatId] = { enabled: false };
        writeStore(store);
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, { text: `Anti-bad DISABLED\n\n${settings.footer}` });
        return;
      }

      const cur = store[chatId];
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `Anti-bad: ${cur?.enabled ? 'ENABLED' : 'DISABLED'}\n` +
          `Action: ${(cur?.action || 'delete').toUpperCase()}\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}antibad on\n` +
          `  ${settings.prefix || '.'}antibad on warn\n` +
          `  ${settings.prefix || '.'}antibad on kick\n` +
          `  ${settings.prefix || '.'}antibad off\n\n` +
          `${settings.footer}`
      });
    } catch (e) {
      console.log('[ANTIBAD] Error:', e.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (x) {}
    }
  }
};

async function antiBadWatcher(conn, mek, chatId) {
  try {
    if (!chatId || !chatId.endsWith('@g.us')) return;

    const store = readStore();
    const cfg = store[chatId];
    if (!cfg || !cfg.enabled) return;

    const sender = mek.key.participant || mek.key.remoteJid;
    if (await isSenderAdmin(conn, chatId, sender)) return;
    if (!(await isBotAdmin(conn, chatId))) return;

    const msg = mek.message || {};
    let text = '';
    if (msg.conversation) text = msg.conversation;
    else if (msg.extendedTextMessage) text = msg.extendedTextMessage.text;
    else if (msg.imageMessage) text = msg.imageMessage.caption || '';
    else if (msg.videoMessage) text = msg.videoMessage.caption || '';
    else if (msg.documentMessage) text = msg.documentMessage.caption || '';

    if (!text || !hasBadWord(text)) return;

    try {
      await conn.sendMessage(chatId, { delete: mek.key });
      console.log('[ANTIBAD] Deleted bad word from', cleanNum(sender));
    } catch (e) {}

    const action = cfg.action || 'delete';

    if (action === 'warn') {
      try {
        await conn.sendMessage(chatId, {
          text: `@${cleanNum(sender)}, watch your language.\n\n${settings.footer}`,
          mentions: [sender]
        });
      } catch (e) {}
    }

    if (action === 'kick') {
      try {
        await conn.groupParticipantsUpdate(chatId, [sender], 'remove');
        await conn.sendMessage(chatId, {
          text: `@${cleanNum(sender)} was removed for bad language.\n\n${settings.footer}`,
          mentions: [sender]
        });
      } catch (e) {}
    }
  } catch (e) {
    console.log('[ANTIBAD] Watcher error:', e.message);
  }
}

module.exports.antiBadWatcher = antiBadWatcher;