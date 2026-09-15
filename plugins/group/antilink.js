const fs = require('fs');
const settings = require('../../settings');
const { isSenderAdmin, isBotAdmin, cleanNum } = require('../../lib/groupAdmin');

const dataPath = './data/antilink.json';
if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, '{}');

function readStore() { try { return JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (e) { return {}; } }
function writeStore(data) { try { fs.writeFileSync(dataPath, JSON.stringify(data, null, 2)); } catch (e) {} }

// ─────────────────────────────────────────────
// LINK DETECTION — broad
// ─────────────────────────────────────────────
function detectLink(text) {
  if (!text) return false;

  const patterns = [
    // WhatsApp group / channel / direct
    /chat\.whatsapp\.com\/[A-Za-z0-9]{10,}/i,
    /whatsapp\.com\/channel\/[A-Za-z0-9]{10,}/i,
    /wa\.me\/[0-9]+/i,
    /api\.whatsapp\.com\/send/i,

    // Telegram
    /t\.me\/[A-Za-z0-9_]+/i,
    /telegram\.me\/[A-Za-z0-9_]+/i,
    /telegram\.dog\/[A-Za-z0-9_]+/i,

    // Generic URLs — any http/https
    /https?:\/\/[^\s]+/i,

    // Shortened links
    /bit\.ly\/[A-Za-z0-9]+/i,
    /tinyurl\.com\/[A-Za-z0-9]+/i,
    /goo\.gl\/[A-Za-z0-9]+/i,
    /cutt\.ly\/[A-Za-z0-9]+/i,
    /shorturl\.at\/[A-Za-z0-9]+/i,

    // Bare domains (no protocol)
    /(?:^|[\s(])(?:[a-z0-9-]+\.)+(?:com|net|org|io|dev|xyz|info|co|ke|app|me|link|site|online|tech|bot)(?:[/\s)]|$)/i
  ];

  return patterns.some(re => re.test(text));
}

module.exports = {
  name: 'antilink',
  aliases: ['al', 'nolink'],
  category: 'group',
  description: 'Delete links posted in the group',
  usage: '.antilink on [delete|warn|kick] | .antilink off',
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
          text:
            `Anti-link ENABLED\n` +
            `Action: ${action.toUpperCase()}\n\n` +
            `Detects:\n` +
            `- WhatsApp invites\n` +
            `- Telegram links\n` +
            `- Any http/https URL\n` +
            `- Bare domains (.com, .net, etc)\n\n` +
            `${settings.footer}`
        });
        return;
      }

      if (choice === 'off') {
        store[chatId] = { enabled: false };
        writeStore(store);
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, { text: `Anti-link DISABLED\n\n${settings.footer}` });
        return;
      }

      const cur = store[chatId];
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `Anti-link: ${cur?.enabled ? 'ENABLED' : 'DISABLED'}\n` +
          `Action: ${(cur?.action || 'delete').toUpperCase()}\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}antilink on\n` +
          `  ${settings.prefix || '.'}antilink on warn\n` +
          `  ${settings.prefix || '.'}antilink on kick\n` +
          `  ${settings.prefix || '.'}antilink off\n\n` +
          `${settings.footer}`
      });
    } catch (e) {
      console.log('[ANTILINK] Error:', e.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (x) {}
    }
  }
};

async function antiLinkWatcher(conn, mek, chatId) {
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

    if (!text) return;

    // Debug log — helps verify detection
    if (detectLink(text)) {
      console.log('[ANTILINK] Detected link in:', text.slice(0, 60));
    }

    if (!detectLink(text)) return;

    try {
      await conn.sendMessage(chatId, { delete: mek.key });
      console.log('[ANTILINK] Deleted link from', cleanNum(sender));
    } catch (e) {
      console.log('[ANTILINK] Delete failed:', e.message);
    }

    const action = cfg.action || 'delete';

    if (action === 'warn') {
      try {
        await conn.sendMessage(chatId, {
          text: `@${cleanNum(sender)}, links are not allowed here.\n\n${settings.footer}`,
          mentions: [sender]
        });
      } catch (e) {}
    }

    if (action === 'kick') {
      try {
        await conn.groupParticipantsUpdate(chatId, [sender], 'remove');
        await conn.sendMessage(chatId, {
          text: `@${cleanNum(sender)} was removed for posting a link.\n\n${settings.footer}`,
          mentions: [sender]
        });
      } catch (e) {}
    }
  } catch (e) {
    console.log('[ANTILINK] Watcher error:', e.message);
  }
}

module.exports.antiLinkWatcher = antiLinkWatcher;