/**
 * NEXORA MD - UI Theme Manager
 * Stores selected theme in data/ui.json
 */

const fs = require('fs');

const UI_FILE = './data/ui.json';
const DEFAULT_THEME = 1;

const THEMES = {
  1:  { name: 'Classic Box',       premium: false },
  2:  { name: 'Double Line',       premium: false },
  3:  { name: 'Minimal',           premium: false },
  4:  { name: 'Bracketed',         premium: false },
  5:  { name: 'Starred',           premium: false },
  6:  { name: 'Arrow',             premium: false },
  7:  { name: 'Dotted',            premium: false },
  8:  { name: 'Double Bracket',    premium: true  },
  9:  { name: 'Ornate Crown',      premium: true  },
  10: { name: 'Gradient Frame',    premium: true  }
};

function ensureDir() {
  if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
}

function getTheme() {
  try {
    if (fs.existsSync(UI_FILE)) {
      const data = JSON.parse(fs.readFileSync(UI_FILE, 'utf8'));
      const n = parseInt(data.theme, 10);
      if (THEMES[n]) return n;
    }
  } catch (e) {}
  return DEFAULT_THEME;
}

function setTheme(n) {
  n = parseInt(n, 10);
  if (!THEMES[n]) return false;
  try {
    ensureDir();
    fs.writeFileSync(UI_FILE, JSON.stringify({ theme: n }, null, 2));
    global.uiTheme = n;
    return true;
  } catch (e) {
    console.log('[UI] Save failed:', e.message);
    return false;
  }
}

function listThemes() {
  return Object.entries(THEMES).map(([n, meta]) => ({
    n: parseInt(n, 10),
    name: meta.name,
    premium: meta.premium
  }));
}

function getThemeInfo(n) {
  return THEMES[n] || THEMES[DEFAULT_THEME];
}

module.exports = {
  getTheme,
  setTheme,
  listThemes,
  getThemeInfo,
  DEFAULT_THEME,
  THEMES
};