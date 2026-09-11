/**
 * NEXORA MD - Owner detection
 * Handles @lid, @s.whatsapp.net, :XX formats
 */

const fs = require('fs');
const settings = require('../settings');

function cleanNumber(num) {
  if (!num) return '';
  let c = String(num).split('@')[0];
  c = c.split(':')[0];
  c = c.replace(/[^0-9]/g, '');
  return c;
}

function getSavedOwners() {
  try {
    if (fs.existsSync('./data/owner.json')) {
      const data = JSON.parse(fs.readFileSync('./data/owner.json', 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (e) {}
  return [];
}

function saveOwner(botNumber, botLid) {
  try {
    if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
    const arr = [botNumber];
    if (botLid) arr.push(botLid);
    fs.writeFileSync('./data/owner.json', JSON.stringify(arr));
    return true;
  } catch (e) {
    return false;
  }
}

function isOwner(sender, conn) {
  if (!sender || !conn || !conn.user) return false;

  const botJid = conn.user.id;
  const botNumber = cleanNumber(botJid);
  const botFullId = botJid.split('@')[0].split(':')[0];
  const botLid = conn.user.lid ? String(conn.user.lid).split(':')[0] : null;

  const senderNumber = cleanNumber(sender);
  const senderFullId = sender.split('@')[0].split(':')[0];
  const senderLidPart = sender.split('@')[0];

  const saved = getSavedOwners();

  const configured = settings.ownerNumber ? cleanNumber(settings.ownerNumber) : null;
  const developer = settings.developerNumber ? cleanNumber(settings.developerNumber) : null;
  const sudo = (settings.sudoUsers || []).map(cleanNumber);

  const match =
    senderNumber === botNumber ||
    senderFullId === botFullId ||
    senderNumber === botFullId ||
    senderFullId === botNumber ||
    (botLid && senderLidPart === botLid) ||
    (botLid && senderNumber === botLid) ||
    (configured && senderNumber === configured) ||
    (developer && senderNumber === developer) ||
    sudo.includes(senderNumber) ||
    saved.includes(senderNumber) ||
    saved.includes(senderLidPart) ||
    saved.includes(senderFullId);

  return match;
}

function getOwnerNumbers(conn) {
  const list = [];
  if (conn && conn.user) {
    list.push(cleanNumber(conn.user.id));
    if (conn.user.lid) list.push(String(conn.user.lid).split(':')[0]);
  }
  getSavedOwners().forEach(x => list.push(cleanNumber(x)));
  if (settings.ownerNumber) list.push(cleanNumber(settings.ownerNumber));
  if (settings.developerNumber) list.push(cleanNumber(settings.developerNumber));
  (settings.sudoUsers || []).forEach(x => list.push(cleanNumber(x)));
  return [...new Set(list.filter(Boolean))];
}

module.exports = { cleanNumber, isOwner, saveOwner, getSavedOwners, getOwnerNumbers };