/**
 * NEXORA MD - Owner Detection
 * Multi-format matching for JID + LID + colon variants
 * Handles cases where WhatsApp returns different IDs for the same user
 */

const fs = require('fs');
const settings = require('../settings');

// ─────────────────────────────────────────────
// ID HELPERS
// ─────────────────────────────────────────────

function cleanNumber(num) {
  if (!num) return '';
  return String(num).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function extractLidPart(id) {
  if (!id) return '';
  return String(id).split('@')[0];
}

// Compare two IDs across JID / LID / number variants
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

// ─────────────────────────────────────────────
// SAVED OWNER FILE (data/owner.json)
// ─────────────────────────────────────────────

function getSavedOwners() {
  try {
    if (fs.existsSync('./data/owner.json')) {
      const data = JSON.parse(fs.readFileSync('./data/owner.json', 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    console.log('[OWNER] Read owner.json failed:', e.message);
  }
  return [];
}

function saveOwner(botNumber, botLid) {
  try {
    if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

    // Load existing
    const existing = getSavedOwners();

    // Build new list with bot JID + LID variants
    const toAdd = new Set(existing);

    if (botNumber) {
      const clean = cleanNumber(botNumber);
      if (clean) {
        toAdd.add(clean);
        toAdd.add(clean + '@s.whatsapp.net');
      }
    }

    if (botLid) {
      const lidClean = extractLidPart(botLid);
      if (lidClean) {
        toAdd.add(lidClean);
        toAdd.add(lidClean + '@lid');
      }
    }

    const finalList = [...toAdd].filter(Boolean);

    fs.writeFileSync('./data/owner.json', JSON.stringify(finalList, null, 2));
    console.log('[OWNER] Saved:', finalList.join(', '));
    return true;
  } catch (e) {
    console.log('[OWNER] Save failed:', e.message);
    return false;
  }
}

// ─────────────────────────────────────────────
// BOT IDS (all formats)
// ─────────────────────────────────────────────

function getBotIds(conn) {
  const ids = new Set();
  if (!conn || !conn.user) return ids;

  if (conn.user.id) {
    ids.add(conn.user.id);
    const idNum = cleanNumber(conn.user.id);
    if (idNum) {
      ids.add(idNum);
      ids.add(idNum + '@s.whatsapp.net');
    }
  }

  if (conn.user.lid) {
    ids.add(conn.user.lid);
    const lidPart = extractLidPart(conn.user.lid);
    if (lidPart) {
      ids.add(lidPart);
      ids.add(lidPart + '@lid');
    }
  }

  return ids;
}

// ─────────────────────────────────────────────
// CONFIGURED OWNERS (from settings.js)
// ─────────────────────────────────────────────

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
// MAIN OWNER CHECK
// ─────────────────────────────────────────────

function isOwner(sender, conn) {
  if (!sender) return false;

  // Build list of all "known owner" identities
  const ownerCandidates = new Set();

  // 1. Bot's own IDs (JID + LID + variants)
  for (const id of getBotIds(conn)) ownerCandidates.add(id);

  // 2. Saved owners from data/owner.json
  for (const id of getSavedOwners()) ownerCandidates.add(id);

  // 3. Configured owners from settings.js
  for (const id of getConfiguredOwners()) ownerCandidates.add(id);

  // Now check sender against every candidate
  const senderId = String(sender);
  const senderNum = cleanNumber(sender);
  const senderLid = extractLidPart(sender);

  for (const cand of ownerCandidates) {
    if (!cand) continue;

    // Direct match
    if (senderId === cand) return true;

    // Multi-format match
    if (idsMatch(senderId, cand)) return true;

    // Number vs LID cross-match
    const candNum = cleanNumber(cand);
    const candLid = extractLidPart(cand);

    if (senderNum && candNum && senderNum === candNum) return true;
    if (senderLid && candLid && senderLid === candLid) return true;
    if (senderNum && candLid && senderNum === candLid) return true;
    if (senderLid && candNum && senderLid === candNum) return true;
  }

  return false;
}

// ─────────────────────────────────────────────
// GET OWNER NUMBERS (for mode check + silent reveal)
// ─────────────────────────────────────────────

function getOwnerNumbers(conn) {
  const list = new Set();

  // Bot's own IDs
  for (const id of getBotIds(conn)) {
    const num = cleanNumber(id);
    if (num) list.add(num);
    const lid = extractLidPart(id);
    if (lid) list.add(lid);
  }

  // Saved owners
  for (const id of getSavedOwners()) {
    const num = cleanNumber(id);
    if (num) list.add(num);
    const lid = extractLidPart(id);
    if (lid) list.add(lid);
  }

  // Configured owners
  for (const id of getConfiguredOwners()) {
    const num = cleanNumber(id);
    if (num) list.add(num);
    const lid = extractLidPart(id);
    if (lid) list.add(lid);
  }

  return [...list].filter(Boolean);
}

// ─────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────

module.exports = {
  cleanNumber,
  extractLidPart,
  idsMatch,
  isOwner,
  saveOwner,
  getSavedOwners,
  getOwnerNumbers,
  getBotIds,
  getConfiguredOwners
};