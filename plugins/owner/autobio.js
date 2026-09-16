/**
 * NEXORA MD - Auto Bio
 * Rotates bot's WhatsApp "About" text every 24 hours
 * Usage:
 *   .autobio on           → start rotation
 *   .autobio off          → stop
 *   .autobio now          → change to next bio immediately
 *   .autobio set <text>   → set a specific bio manually
 *   .autobio list         → show all quotes
 *   .autobio             → show status
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/autobio.json';
const ROTATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

// ─────────────────────────────────────────────
// BIO LIBRARY — edit to add your own
// ─────────────────────────────────────────────
const BIO_LIBRARY = [
  // Bot identity
  'NEXORA MD — Fast. Clean. Powerful.',
  'NEXORA MD — Powered by Rodgers',
  'NEXORA MD — Your AI WhatsApp companion',
  'NEXORA MD — Always online, always ready',
  'NEXORA MD — Manage groups like a pro',
  'NEXORA MD — The future of WhatsApp bots',
  'NEXORA MD — Built different',
  'NEXORA MD — Speed meets reliability',

  // Quotes
  'Life is short. Use a bot.',
  'Automate everything.',
  'Efficiency is a superpower.',
  'Stay curious, stay building.',
  'Code is poetry.',
  'Silence is golden. Speed is platinum.',
  'Built to serve.',
  'Discipline over motivation.',
  'Move quietly, build loudly.',
  'Dream big. Ship bigger.',
  'Consistency beats talent.',
  'Work smart. Rest smart.',
  'Learn. Build. Repeat.',
  'Never stop improving.',
  'The best time to start is now.',
  'Do it right or do it twice.',
  'Progress over perfection.',
  'Simple is powerful.',
  'Focus is the new IQ.',
  'Make it work. Make it fast.',
  'Tools that free your time.',
  'Write once, run everywhere.',
  'Less noise. More signal.',
  'Be the reason someone smiles.',
  'Lead with kindness.',
  'Small habits, big changes.',
  'Time is the only currency.',
  'Slow is smooth. Smooth is fast.',
  'Every master was once a beginner.',
  'Enjoy the process.',

  // Short and clean
  'NEXORA',
  'Powered by Rodgers',
  'NEXORA MD — v. Always',
  'Online 24/7',
  'Here to help.',
  'Ready when you are.',
  'Just a bot doing bot things.',
  'Your group, my rules.',
  'Bot mode: ON.',
  'Silent but deadly efficient.'
];

// ─────────────────────────────────────────────
// STORE HELPERS
// ─────────────────────────────────────────────
function readStore() {
  try {
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
  } catch (e) {}
  return {
    enabled: false,
    index: 0,
    lastChange: 0
  };
}

function writeStore(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('[AUTOBIO] Write failed:', e.message);
  }
}

// ─────────────────────────────────────────────
// APPLY BIO
// ─────────────────────────────────────────────
async function applyBio(conn, text) {
  try {
    await conn.updateProfileStatus(text);
    console.log('[AUTOBIO] Bio updated to:', text);
    return true;
  } catch (e) {
    console.log('[AUTOBIO] Failed to update bio:', e.message);
    return false;
  }
}

// ─────────────────────────────────────────────
// ROTATION TIMER
// ─────────────────────────────────────────────
async function rotateBio(conn) {
  const store = readStore();
  if (!store.enabled) return;

  const nextIndex = (store.index + 1) % BIO_LIBRARY.length;
  const nextBio = BIO_LIBRARY[nextIndex];

  const ok = await applyBio(conn, nextBio);
  if (ok) {
    store.index = nextIndex;
    store.lastChange = Date.now();
    writeStore(store);
  }
}

// Store socket so timer can access it
let activeConn = null;
let bioTimer = null;

function startTimer() {
  if (bioTimer) clearInterval(bioTimer);
  bioTimer = setInterval(async () => {
    if (activeConn) {
      await rotateBio(activeConn);
    }
  }, ROTATION_INTERVAL);
  console.log('[AUTOBIO] Timer started (24h interval)');
}

function stopTimer() {
  if (bioTimer) {
    clearInterval(bioTimer);
    bioTimer = null;
    console.log('[AUTOBIO] Timer stopped');
  }
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'autobio',
  aliases: ['ab', 'autoprofile', 'autostatus'],
  category: 'owner',
  description: 'Auto-rotate bot bio every 24 hours',
  usage: '.autobio on | off | now | set <text> | list',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      activeConn = conn; // remember socket for timer
      const store = readStore();
      const sub = (args[0] || '').toLowerCase();

      // ─────────────────────────────────────────
      // ON
      // ─────────────────────────────────────────
      if (sub === 'on') {
        store.enabled = true;
        if (store.lastChange === 0) store.lastChange = Date.now();
        writeStore(store);

        // Apply current bio immediately
        const currentBio = BIO_LIBRARY[store.index] || BIO_LIBRARY[0];
        await applyBio(conn, currentBio);
        startTimer();

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `AUTO-BIO ENABLED\n\n` +
            `Rotates every 24 hours.\n` +
            `Total bios: ${BIO_LIBRARY.length}\n` +
            `Current: ${currentBio}\n\n` +
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
        stopTimer();

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `AUTO-BIO DISABLED\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // NOW (rotate immediately)
      // ─────────────────────────────────────────
      if (sub === 'now') {
        await rotateBio(conn);
        const updated = readStore();
        const newBio = BIO_LIBRARY[updated.index];

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Bio changed.\n\n` +
            `Index: ${updated.index + 1}/${BIO_LIBRARY.length}\n` +
            `New bio: ${newBio}\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // SET (manual)
      // ─────────────────────────────────────────
      if (sub === 'set') {
        const text = args.slice(1).join(' ').trim();
        if (!text) {
          await conn.sendMessage(chatId, {
            text: `Usage: ${settings.prefix || '.'}autobio set Your bio text here\n\n${settings.footer}`
          });
          return;
        }

        const ok = await applyBio(conn, text);
        await conn.sendMessage(chatId, { react: { text: ok ? '✅' : '❌', key: mek.key } });
        if (ok) {
          await conn.sendMessage(chatId, {
            text: `Bio set manually.\n\n${settings.footer}`
          });
        } else {
          await conn.sendMessage(chatId, {
            text: `Failed to set bio.\n\n${settings.footer}`
          });
        }
        return;
      }

      // ─────────────────────────────────────────
      // LIST
      // ─────────────────────────────────────────
      if (sub === 'list') {
        const currentIndex = store.index;
        let text = `BIO LIBRARY (${BIO_LIBRARY.length} items)\n\n`;

        BIO_LIBRARY.forEach((bio, i) => {
          const marker = i === currentIndex ? ' (current)' : '';
          text += `${i + 1}. ${bio}${marker}\n`;
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
      const currentBio = BIO_LIBRARY[store.index] || BIO_LIBRARY[0];
      const nextChange = store.lastChange
        ? new Date(store.lastChange + ROTATION_INTERVAL).toLocaleString()
        : 'not started';

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `AUTO-BIO\n\n` +
          `Status: ${enabled}\n` +
          `Current: ${currentBio}\n` +
          `Index: ${store.index + 1}/${BIO_LIBRARY.length}\n` +
          `Next change: ${nextChange}\n\n` +
          `Usage:\n` +
          `  ${settings.prefix || '.'}autobio on         - enable rotation\n` +
          `  ${settings.prefix || '.'}autobio off        - disable\n` +
          `  ${settings.prefix || '.'}autobio now        - rotate now\n` +
          `  ${settings.prefix || '.'}autobio set <text> - set manual bio\n` +
          `  ${settings.prefix || '.'}autobio list       - list all bios\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[AUTOBIO] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  },

  // Called by index.js on boot to resume rotation
  startTimer: (conn) => {
    activeConn = conn;
    const store = readStore();
    if (store.enabled) {
      // Check if it's time to rotate
      const elapsed = Date.now() - (store.lastChange || 0);
      if (elapsed >= ROTATION_INTERVAL) {
        rotateBio(conn);
      }
      startTimer();
    }
  }
};