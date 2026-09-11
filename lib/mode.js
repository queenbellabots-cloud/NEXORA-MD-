/**
 * NEXORA MD - Public/Private Mode Manager
 * Persists to data/mode.json
 */

const fs = require('fs');
const path = require('path');

const MODE_FILE = './data/mode.json';

function ensureDir() {
  if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data', { recursive: true });
  }
}

function getMode(fallback) {
  try {
    if (fs.existsSync(MODE_FILE)) {
      const data = JSON.parse(fs.readFileSync(MODE_FILE, 'utf8'));
      if (data.mode === 'public' || data.mode === 'private') {
        return data.mode;
      }
    }
  } catch (e) {}
  return fallback || 'public';
}

function setMode(mode) {
  if (mode !== 'public' && mode !== 'private') return false;
  try {
    ensureDir();
    fs.writeFileSync(MODE_FILE, JSON.stringify({ mode }, null, 2));
    global.botMode = mode;
    return true;
  } catch (e) {
    return false;
  }
}

function isAllowed(sender, ownerNumbers, mode) {
  if (mode === 'public') return true;
  if (mode === 'private') {
    const clean = (s) => String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    const senderClean = clean(sender);
    return ownerNumbers.some(o => clean(o) === senderClean);
  }
  return true;
}

module.exports = { getMode, setMode, isAllowed };