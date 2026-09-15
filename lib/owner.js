/**
 * NEXORA MD - Owner Detection (Bulletproof)
 * Matches sender against paired number, paired LID, and both formats
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
  return String(id).split('@')[0].split(':')[0];
}

function maskNumber(num) {
  const c = cleanNumber(num);
  if (!c || c.length < 6) return c || 'unknown';
  return c.slice(0, 6) + 'X'.repeat(Math.max(0, c.length - 6));
}

function ensureDataDir() {
  if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
}

// ─────────────────────────────────────────────
// READ PAIRED NUMBER + LID FROM creds.json
// ─────────────────────────────────────────────

function readCreds() {
  const result = { id: null, lid: null };
  try {
    if (fs.existsSync('./data/session/creds.json')) {
      const creds = JSON.parse(fs.readFileSync('./data/session/creds.json', 'utf8'));
      if (creds && creds.me) {
        if (creds.me.id) result.id = creds.me.id;
        if (creds.me.lid) result.lid = creds.me.lid;
      }
    }
  } catch (e) {
    console.log('[OWNER] creds.json read failed:', e.message);
  }
  return result;
}

function getPairedNumber() {
  const creds = readCreds();
  if (creds.id) return cleanNumber(creds.id);
  return '';
}

function getPairedLid() {
  const creds = readCreds();
  if (creds.lid) return extractLidPart(creds.lid);
  return '';
}

// ─────────────────────────────────────────────
// OWNER CHECK
// ─────────────────────────────────────────────

function isOwner(sender, conn) {
  if (!sender) return false;

  const senderFull = String(sender);
  const senderNum = cleanNumber(sender);
  const senderLid = extractLidPart(sender);

  // ─── 1. From creds.json (most reliable) ───
  const pairedNum = getPairedNumber();
  const pairedLid = getPairedLid();

  if (pairedNum && senderNum && pairedNum === senderNum) return true;
  if (pairedLid && senderLid && pairedLid === senderLid) return true;
  if (pairedNum && senderLid && pairedNum === senderLid) return true;
  if (pairedLid && senderNum && pairedLid === senderNum) return true;

  // ─── 2. From live conn.user ───
  if (conn && conn.user) {
    const botNum = cleanNumber(conn.user.id);
    const botLid = conn.user.lid ? extractLidPart(conn.user.lid) : '';

    if (botNum && senderNum && botNum === senderNum) return true;
    if (botLid && senderLid && botLid === senderLid) return true;
    if (botNum && senderLid && botNum === senderLid) return true;
    if (botLid && senderNum && botLid === senderNum) return true;
  }

  // ─── 3. From settings.ownerNumber ───
  if (settings.ownerNumber) {
    const cfgNum = cleanNumber(settings.ownerNumber);
    if (cfgNum && senderNum && cfgNum === senderNum) return true;
  }

  // ─── 4. Developer + sudo ───
  if (settings.developerNumber && cleanNumber(settings.developerNumber) === senderNum) return true;
  if (Array.isArray(settings.sudoUsers)) {
    for (const u of settings.sudoUsers) {
      if (cleanNumber(u) === senderNum) return true;
    }
  }

  // ─── 5. Log for diagnostics ───
  try {
    console.log(
      `[OWNER] Rejected. Sender: ${maskNumber(sender)} | ` +
      `Paired: ${maskNumber(pairedNum)} | Paired LID: ${maskNumber(pairedLid)}`
    );
  } catch (e) {}

  return false;
}

// ─────────────────────────────────────────────
// OWNER NUMBERS (for mode, silent reveal)
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
      const l = extractLidPart(conn.user.lid);
      if (l) list.add(l);
    }
  }

  if (settings.ownerNumber) list.add(cleanNumber(settings.ownerNumber));
  if (settings.developerNumber) list.add(cleanNumber(settings.developerNumber));
  if (Array.isArray(settings.sudoUsers)) {
    settings.sudoUsers.forEach(u => list.add(cleanNumber(u)));
  }

  return [...list].filter(Boolean);
}

// ─────────────────────────────────────────────
// COMPAT EXPORTS
// ─────────────────────────────────────────────

function saveOwner() { return true; }
function getSavedOwners() { return []; }
function rememberSender() { return true; }
function idsMatch(a, b) {
  const aNum = cleanNumber(a);
  const bNum = cleanNumber(b);
  return aNum && bNum && aNum === bNum;
}
function getBotIds(conn) {
  const ids = new Set();
  if (conn && conn.user && conn.user.id) ids.add(conn.user.id);
  if (conn && conn.user && conn.user.lid) ids.add(conn.user.lid);
  const p = getPairedNumber();
  if (p) ids.add(p);
  const l = getPairedLid();
  if (l) ids.add(l);
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