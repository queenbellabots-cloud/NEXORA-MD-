/**
 * NEXORA MD - Owner Detection
 * The owner is ALWAYS the paired number.
 * Reads paired number from creds.json + live conn.
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

function ensureDataDir() {
  if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
}

// ─────────────────────────────────────────────
// PAIRED NUMBER (source of truth)
// ─────────────────────────────────────────────

/**
 * Get the paired bot number from creds.json
 * This is THE owner — whoever paired the bot
 */
function getPairedNumber() {
  try {
    if (fs.existsSync('./data/session/creds.json')) {
      const creds = JSON.parse(fs.readFileSync('./data/session/creds.json', 'utf8'));
      if (creds && creds.me && creds.me.id) {
        return cleanNumber(creds.me.id);
      }
    }
  } catch (e) {}
  return '';
}

/**
 * Get the paired bot's LID from creds.json
 */
function getPairedLid() {
  try {
    if (fs.existsSync('./data/session/creds.json')) {
      const creds = JSON.parse(fs.readFileSync('./data/session/creds.json', 'utf8'));
      if (creds && creds.me && creds.me.lid) {
        return String(creds.me.lid).split('@')[0].split(':')[0];
      }
    }
  } catch (e) {}
  return '';
}

// ─────────────────────────────────────────────
// OWNER CHECK (simple and correct)
// ─────────────────────────────────────────────

function isOwner(sender, conn) {
  if (!sender) return false;

  const senderNum = cleanNumber(sender);
  const senderFull = String(sender);

  // 1. Live conn user id
  if (conn && conn.user) {
    const botNum = cleanNumber(conn.user.id);
    if (botNum && senderNum && botNum === senderNum) return true;

    const botLid = conn.user.lid ? String(conn.user.lid).split('@')[0].split(':')[0] : '';
    if (botLid && senderFull && senderFull.split('@')[0].split(':')[0] === botLid) return true;
  }

  // 2. creds.json (the source of truth)
  const pairedNum = getPairedNumber();
  if (pairedNum && senderNum && pairedNum === senderNum) return true;

  const pairedLid = getPairedLid();
  if (pairedLid && senderFull && senderFull.split('@')[0].split(':')[0] === pairedLid) return true;

  // 3. settings.ownerNumber (manual override)
  if (settings.ownerNumber) {
    const configNum = cleanNumber(settings.ownerNumber);
    if (configNum && senderNum && configNum === senderNum) return true;
  }

  // 4. Developer + sudo
  if (settings.developerNumber && cleanNumber(settings.developerNumber) === senderNum) return true;
  if (Array.isArray(settings.sudoUsers)) {
    for (const u of settings.sudoUsers) {
      if (cleanNumber(u) === senderNum) return true;
    }
  }

  return false;
}

// ─────────────────────────────────────────────
// OWNER NUMBERS (for mode check, silent reveal)
// ─────────────────────────────────────────────

function getOwnerNumbers(conn) {
  const list = new Set();

  const pairedNum = getPairedNumber();
  if (pairedNum) list.add(pairedNum);

  const pairedLid = getPairedLid();
  if (pairedLid) list.add(pairedLid);

  if (conn && conn.user) {
    const n = cleanNumber(conn.user.id);
    if (n) list.add(n);
    if (conn.user.lid) {
      const l = String(conn.user.lid).split('@')[0].split(':')[0];
      if (l) list.add(l);
    }
  }

  if (settings.ownerNumber) {
    const n = cleanNumber(settings.ownerNumber);
    if (n) list.add(n);
  }
  if (settings.developerNumber) {
    const n = cleanNumber(settings.developerNumber);
    if (n) list.add(n);
  }
  if (Array.isArray(settings.sudoUsers)) {
    settings.sudoUsers.forEach(u => {
      const n = cleanNumber(u);
      if (n) list.add(n);
    });
  }

  return [...list].filter(Boolean);
}

// ─────────────────────────────────────────────
// SIMPLE NO-OPS (kept for compatibility)
// ─────────────────────────────────────────────

function saveOwner() { return true; }
function getSavedOwners() { return []; }
function rememberSender() { return true; }
function extractLidPart(id) {
  return String(id || '').split('@')[0].split(':')[0];
}
function maskNumber(num) {
  const c = cleanNumber(num);
  if (!c || c.length < 6) return c || 'unknown';
  return c.slice(0, 6) + 'X'.repeat(Math.max(0, c.length - 6));
}
function idsMatch(a, b) {
  const aNum = cleanNumber(a);
  const bNum = cleanNumber(b);
  return aNum && bNum && aNum === bNum;
}
function getBotIds(conn) {
  const ids = new Set();
  if (conn && conn.user && conn.user.id) ids.add(conn.user.id);
  if (conn && conn.user && conn.user.lid) ids.add(conn.user.lid);
  return ids;
}
function getConfiguredOwners() {
  const list = [];
  if (settings.ownerNumber) list.push(settings.ownerNumber);
  if (settings.developerNumber) list.push(settings.developerNumber);
  if (Array.isArray(settings.sudoUsers)) list.push(...settings.sudoUsers);
  return list.filter(Boolean);
}
function isPairedNumber(sender, conn) {
  return isOwner(sender, conn);
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
  getConfiguredOwners,
  getPairedNumber,
  getPairedLid
};