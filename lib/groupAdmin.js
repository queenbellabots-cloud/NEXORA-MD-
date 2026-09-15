/**
 * NEXORA MD - Group Admin Checks
 * Matches participants by JID + LID to work with modern WhatsApp
 */

const fs = require('fs');

function cleanNum(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function extractLidPart(s) {
  return String(s || '').split('@')[0].split(':')[0];
}

function getPairedLid() {
  try {
    if (fs.existsSync('./data/session/creds.json')) {
      const creds = JSON.parse(fs.readFileSync('./data/session/creds.json', 'utf8'));
      if (creds && creds.me && creds.me.lid) {
        return extractLidPart(creds.me.lid);
      }
    }
  } catch (e) {}
  return '';
}

function getPairedNumber() {
  try {
    if (fs.existsSync('./data/session/creds.json')) {
      const creds = JSON.parse(fs.readFileSync('./data/session/creds.json', 'utf8'));
      if (creds && creds.me && creds.me.id) {
        return cleanNum(creds.me.id);
      }
    }
  } catch (e) {}
  return '';
}

function idsMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const aNum = cleanNum(a);
  const bNum = cleanNum(b);
  const aLid = extractLidPart(a);
  const bLid = extractLidPart(b);
  return (
    (aNum && bNum && aNum === bNum) ||
    (aLid && bLid && aLid === bLid) ||
    (aNum && bLid && aNum === bLid) ||
    (aLid && bNum && aLid === bNum)
  );
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
    console.log('[ADMIN] isSenderAdmin failed:', e.message);
    return false;
  }
}

async function isBotAdmin(conn, groupId) {
  try {
    const meta = await conn.groupMetadata(groupId);

    const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
    const botLid = conn.user.lid
      ? extractLidPart(conn.user.lid)
      : getPairedLid();
    const pairedNum = getPairedNumber();

    const me = meta.participants.find(p => {
      if (idsMatch(p.id, botJid)) return true;
      if (p.lid && idsMatch(p.lid, botJid)) return true;
      if (pairedNum && idsMatch(p.id, pairedNum)) return true;
      if (botLid && idsMatch(p.id, botLid)) return true;
      if (botLid && p.lid && idsMatch(p.lid, botLid)) return true;
      return false;
    });

    if (!me) {
      console.log('[ADMIN] Bot not found in participants');
      console.log('[ADMIN] Looking for:', botJid, '| LID:', botLid, '| Paired:', pairedNum);
      console.log('[ADMIN] Participants sample:', meta.participants.slice(0, 3).map(p => p.id).join(', '));
      return false;
    }

    return me.admin === 'admin' || me.admin === 'superadmin';
  } catch (e) {
    console.log('[ADMIN] isBotAdmin failed:', e.message);
    return false;
  }
}

module.exports = {
  cleanNum,
  extractLidPart,
  idsMatch,
  getPairedLid,
  getPairedNumber,
  isSenderAdmin,
  isBotAdmin
};