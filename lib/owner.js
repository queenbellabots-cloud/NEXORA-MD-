/**
 * NEXORA MD - Owner Detection (Bulletproof)
 * Layer 1: Direct number match (sender == bot's paired number)
 * Layer 2: Multi-source check (settings + owner.json)
 * Layer 3: Self-learning (remember sender formats)
 */

const fs = require('fs');
const settings = require('../settings');

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function cleanNumber(num) {
  if (!num) return '';
  return String(num).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function extractLidPart(id) {
  if (!id) return '';
  return String(id).split('@')[0];
}

function maskNumber(num) {
  const c = cleanNumber(num);
  if (!c || c.length < 6) return c || 'unknown';
  return c.slice(0, 6) + 'X'.repeat(Math.max(0, c.length - 6));
}

function idsMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;

  const aNum = cleanNumber(a);
  const bNum = cleanNumber(b);
  const aLid = extractLidPart(a);
  const bLid = extractLidPart(b);

  return (
    (aNum && bNum && aNum === bNum) ||
    (aLid && bLid && aLid === bLid) ||
    (aNum && bLid && aNum === bLid) ||
    (aLid && bNum && aLid === bNum)
  );
}

function ensureDataDir() {
  if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
}

// ─────────────────────────────────────────────
// OWNER FILE
// ─────────────────────────────────────────────

function getSavedOwners() {
  try {
    if (fs.existsSync('./data/owner.json')) {
      const data = JSON.parse(fs.readFileSync('./data/owner.json', 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    console.log('[OWNER] Read failed:', e.message);
  }
  return [];
}

function saveOwner(botNumber, botLid) {
  try {
    ensureDataDir();
    const existing = getSavedOwners();
    const set = new Set(existing);

    if (botNumber) {
      const c = cleanNumber(botNumber);
      if (c) {
        set.add(c);
        set.add(c + '@s.whatsapp.net');
      }
    }
    if (botLid) {
      const l = extractLidPart(botLid);
      if (l) {
        set.add(l);
        set.add(l + '@lid');
      }
    }

    const final = [...set].filter(Boolean);
    fs.writeFileSync('./data/owner.json', JSON.stringify(final, null, 2));
    console.log('[OWNER] Saved:', final.join(', '));
    return true;
  } catch (e) {
    console.log('[OWNER] Save failed:', e.message);
    return false;
  }
}

// ─────────────────────────────────────────────
// BOT IDS
// ─────────────────────────────────────────────

function getBotIds(conn) {
  const ids = new Set();
  if (!conn || !conn.user) return ids;

  if (conn.user.id) {
    ids.add(conn.user.id);
    const n = cleanNumber(conn.user.id);
    if (n) {
      ids.add(n);
      ids.add(n + '@s.whatsapp.net');
    }
  }
  if (conn.user.lid) {
    ids.add(conn.user.lid);
    const l = extractLidPart(conn.user.lid);
    if (l) {
      ids.add(l);
      ids.add(l + '@lid');
    }
  }
  return ids;
}

function getConfiguredOwners() {
  const list = [];
  if (settings.ownerNumber) list.push(settings.ownerNumber);
  if (settings.developerNumber) list.push(settings.developerNumber);
  if (Array.isArray(settings.sudoUsers)) {
    settings.sudoUsers.forEach(u => list.push(u));
  }
  return list.filter(Boolean);
}

// ─────────────────────────────────────────────
// LAYER 1: Direct number match (bot's own paired number)
// ─────────────────────────────────────────────

function isPairedNumber(sender, conn) {
  if (!sender || !conn || !conn.user) return false;

  const botNum = cleanNumber(conn.user.id);
  const senderNum = cleanNumber(sender);

  if (!botNum || !senderNum) return false;

  // Direct number match — most reliable
  if (botNum === senderNum) return true;

  // LID match
  const botLid = conn.user.lid ? extractLidPart(conn.user.lid) : null;
  const senderLid = extractLidPart(sender);
  if (botLid && senderLid && botLid === senderLid) return true;

  return false;
}

// ─────────────────────────────────────────────
// LAYER 3: Self-learning
// ─────────────────────────────────────────────

function rememberSender(sender, conn) {
  if (!sender || !conn || !conn.user) return false;
  if (!isPairedNumber(sender, conn)) return false;

  try {
    ensureDataDir();
    const existing = getSavedOwners();
    const set = new Set(existing);

    set.add(sender);
    const n = cleanNumber(sender);
    if (n) set.add(n);
    const l = extractLidPart(sender);
    if (l) set.add(l);

    const final = [...set].filter(Boolean);
    fs.writeFileSync('./data/owner.json', JSON.stringify(final, null, 2));
    console.log('[OWNER] Remembered sender format:', maskNumber(sender));
    return true;
  } catch (e) {
    console.log('[OWNER] Remember failed:', e.message);
    return false;
  }
}

// ─────────────────────────────────────────────
// MAIN CHECK (all layers)
// ─────────────────────────────────────────────

function isOwner(sender, conn) {
  if (!sender) return false;

  // Layer 1 — paired number match
  if (isPairedNumber(sender, conn)) return true;

  // Layer 2 — multi-source check
  const candidates = new Set();

  for (const id of getBotIds(conn)) candidates.add(id);
  for (const id of getSavedOwners()) candidates.add(id);
  for (const id of getConfiguredOwners()) candidates.add(id);

  const senderId = String(sender);

  for (const cand of candidates) {
    if (!cand) continue;
    if (senderId === cand) return true;
    if (idsMatch(senderId, cand)) return true;
  }

  // Layer 3 — if nothing matched, log for diagnostics
  try {
    const botNum = conn && conn.user ? cleanNumber(conn.user.id) : 'unknown';
    const senderNum = cleanNumber(sender);
    console.log(
      `[OWNER] Rejected. Sender: ${maskNumber(sender)} | ` +
      `Bot: ${maskNumber(botNum)} | Format: ${sender.split('@')[1] || 'unknown'}`
    );
  } catch (e) {}

  return false;
}

// ─────────────────────────────────────────────
// OWNER NUMBERS (for mode check, silent reveal)
// ─────────────────────────────────────────────

function getOwnerNumbers(conn) {
  const list = new Set();

  for (const id of getBotIds(conn)) {
    const n = cleanNumber(id);
    if (n) list.add(n);
    const l = extractLidPart(id);
    if (l) list.add(l);
  }
  for (const id of getSavedOwners()) {
    const n = cleanNumber(id);
    if (n) list.add(n);
    const l = extractLidPart(id);
    if (l) list.add(l);
  }
  for (const id of getConfiguredOwners()) {
    const n = cleanNumber(id);
    if (n) list.add(n);
    const l = extractLidPart(id);
    if (l) list.add(l);
  }

  return [...list].filter(Boolean);
}

module.exports = {
  cleanNumber,
  extractLidPart,
  maskNumber,
  idsMatch,
  isOwner,
  isPairedNumber,
  rememberSender,
  saveOwner,
  getSavedOwners,
  getOwnerNumbers,
  getBotIds,
  getConfiguredOwners
};