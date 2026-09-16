/**
 * NEXORA MD - Anti-Block Detection
 * Detects when someone may have blocked the bot and notifies owner
 * Usage:
 *   .antiblock on
 *   .antiblock off
 *   .antiblock
 *   .antiblock check <number>   → manual check
 */

const fs = require('fs');
const settings = require('../../settings');
const owner = require('../../lib/owner');

const dataPath = './data/antiblock.json';
const dataBlockedPath = './data/antiblock_detected.json';

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function readStore() {
  try {
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
  } catch (e) {}
  return { enabled: false };
}

function writeStore(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('[ANTIBLOCK] Write failed:', e.message);
  }
}

function readDetected() {
  try {
    if (fs.existsSync(dataBlockedPath)) {
      return JSON.parse(fs.readFileSync(dataBlockedPath, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function writeDetected(data) {
  try {
    fs.writeFileSync(dataBlockedPath, JSON.stringify(data, null, 2));
  } catch (e) {}
}

// ─────────────────────────────────────────────
// MANUAL CHECK
// ─────────────────────────────────────────────
async function checkBlocked(conn, target) {
  try {
    // Try to fetch their profile picture — blocked users return an error
    const res = await conn.onWhatsApp(target);
    if (!res || res.length === 0) {
      return { status: 'not-on-whatsapp' };
    }

    // Try sending a silent typing presence — if blocked, it fails silently
    try {
      await conn.presenceSubscribe(target);
    } catch (e) {
      if (e.message && (e.message.includes('forbidden') || e.message.includes('unauthorized'))) {
        return { status: 'blocked' };
      }
    }

    return { status: 'ok' };
  } catch (e) {
    if (e.message && (e.message.includes('forbidden') || e.message.includes('unauthorized'))) {
      return { status: 'blocked' };
    }
    return { status: 'unknown', error: e.message };
  }
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'antiblock',
  aliases: ['ablk', 'blockdetect'],
  category: 'owner',
  description: 'Detect when someone blocks the bot',
  usage: '.antiblock on | off | check <number>',
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

      // ─────────────────────────────────────────
      // ON
      // ─────────────────────────────────────────
      if (sub === 'on') {
        store.enabled = true;
        writeStore(store);
        global.antiBlock = true;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `ANTI-BLOCK ENABLED\n\n` +
            `The bot will notify you when a message send fails with a block-related error.\n\n` +
            `Note: WhatsApp does not send a "blocked" event. Detection works by catching send failures.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // OFF
      // ─────────────────────────────────────────
      if (sub === 'off') {
        store.enabled = false;
        writeStore(store);
        global.antiBlock = false;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `ANTI-BLOCK DISABLED\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // CHECK (manual)
      // ─────────────────────────────────────────
      if (sub === 'check') {
        const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
        const mentioned = contextInfo?.mentionedJid || [];
        const quoted = contextInfo?.participant;
        let target = mentioned[0] || quoted;

        if (!target && args[1]) {
          const num = String(args[1]).replace(/[^0-9]/g, '');
          if (num.length >= 8) target = num + '@s.whatsapp.net';
        }

        if (!target) {
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          await conn.sendMessage(chatId, {
            text: `Usage: ${settings.prefix || '.'}antiblock check @user OR ${settings.prefix || '.'}antiblock check 254712345678\n\n${settings.footer}`
          });
          return;
        }

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, { text: `Checking...` });

        const result = await checkBlocked(conn, target);
        const num = String(target).split('@')[0];

        let statusText = '';
        if (result.status === 'ok') statusText = 'Not blocked (or unknown)';
        else if (result.status === 'blocked') statusText = 'BLOCKED';
        else if (result.status === 'not-on-whatsapp') statusText = 'Not on WhatsApp';
        else statusText = `Unknown (${result.error || 'no error'})`;

        await conn.sendMessage(chatId, {
          text:
            `BLOCK CHECK\n\n` +
            `Number: ${num}\n` +
            `Status: ${statusText}\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // LIST DETECTED
      // ─────────────────────────────────────────
      if (sub === 'list') {
        const detected = readDetected();
        const entries = Object.entries(detected);

        if (entries.length === 0) {
          await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
          await conn.sendMessage(chatId, {
            text: `No blocked numbers detected yet.\n\n${settings.footer}`
          });
          return;
        }

        let text = `DETECTED BLOCKS\n\n`;
        entries.forEach(([num, info], i) => {
          text += `${i + 1}. ${num} — detected ${info.date}\n`;
        });
        text += `\n${settings.footer}`;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, { text });
        return;
      }

      // ─────────────────────────────────────────
      // STATUS
      // ─────────────────────────────────────────
      const enabled = store.enabled ? 'ENABLED' : 'DISABLED';
      const detected = readDetected();
      const count = Object.keys(detected).length;

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `ANTI-BLOCK\n\n` +
          `Status: ${enabled}\n` +
          `Detected blocks: ${count}\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}antiblock on            - enable\n` +
          `  ${settings.prefix || '.'}antiblock off           - disable\n` +
          `  ${settings.prefix || '.'}antiblock check @user   - check specific\n` +
          `  ${settings.prefix || '.'}antiblock list          - show detected\n\n` +
          `Note: Detection works by catching send failures — WhatsApp doesn't report blocks directly.\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[ANTIBLOCK] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};