/**
 * NEXORA MD - Menu Command (Multi-Theme)
 * Renders menu in the current theme. Image fetched via axios buffer.
 */

const settings = require('../../settings');
const axios = require('axios');
const ui = require('../../lib/ui');

const MENU_REACTIONS = ['👑', '✨', '🌟', '🔥', '💫', '⭐', '🎯', '🚀', '💎', '🎉'];

// ─────────────────────────────────────────────
// IMAGE FETCH
// ─────────────────────────────────────────────
async function fetchImageBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 20000,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/*,*/*;q=0.8'
    }
  });

  const type = res.headers['content-type'] || '';
  if (!type.startsWith('image/')) {
    throw new Error(`Not an image: content-type=${type}`);
  }
  return Buffer.from(res.data);
}

// ─────────────────────────────────────────────
// SYSTEM INFO HELPERS
// ─────────────────────────────────────────────
const START_TIME = Date.now();

function uptime() {
  const ms = Date.now() - START_TIME;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function ramMB() {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

function formatNow() {
  return new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// ─────────────────────────────────────────────
// COMMAND LIST BUILDER
// ─────────────────────────────────────────────
function buildCategories() {
  const commands = global.commands;
  const categories = {};

  if (!commands || typeof commands.forEach !== 'function') {
    return { categories: {}, total: 0 };
  }

  const seen = new Set();
  const list = [];

  commands.forEach(cmd => {
    try {
      if (!cmd || typeof cmd !== 'object') return;
      if (!cmd.name || seen.has(cmd.name)) return;
      seen.add(cmd.name);
      list.push({
        name: cmd.name,
        category: (typeof cmd.category === 'string' && cmd.category) ? cmd.category : 'general'
      });
    } catch (e) {}
  });

  list.forEach(c => {
    const cat = String(c.category).toUpperCase();
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(c.name);
  });

  return { categories, total: list.length };
}

// ─────────────────────────────────────────────
// SHARED INFO BLOCK
// ─────────────────────────────────────────────
function infoLines(pushName) {
  const currentMode = global.botMode ? String(global.botMode).toUpperCase() : 'PUBLIC';
  return {
    botName: settings.botName || 'NEXORA MD',
    owner: settings.botOwner || 'Rodgers',
    dev: settings.developerName || 'RODGERS',
    prefix: settings.prefix || '.',
    user: pushName || 'User',
    mode: currentMode,
    uptime: uptime(),
    ram: ramMB(),
    platform: process.platform,
    node: process.version,
    time: formatNow()
  };
}

// ─────────────────────────────────────────────
// THEME RENDERERS
// ─────────────────────────────────────────────

// THEME 1 - Classic Box
function render1(info, categories, total, prefix) {
  let t = `╔═══════════════════╗\n`;
  t += `╠  ${info.botName}\n`;
  t += `╠  𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝚋𝚢 𝚁𝚘𝚍𝚐𝚎𝚛𝚜\n`;
  t += `╚════════════════════╝\n\n`;
  t += `╠ Owner: ${info.owner}\n`;
  t += `╠ Prefix: ${prefix}\n`;
  t += `╠ User: ${info.user}\n`;
  t += `╠ Mode: ${info.mode}\n`;
  t += `╠ Uptime: ${info.uptime}\n`;
  t += `╠ RAM: ${info.ram} MB\n`;
  t += `╠ Platform: ${info.platform}\n`;
  t += `╠ Node: ${info.node}\n`;
  t += `╠ Commands: ${total}\n`;
  t += `╠ Time: ${info.time}\n`;

  for (const cat of Object.keys(categories).sort()) {
    t += `\n╔═══ [ ${cat} ] ═══╗\n`;
    for (const cmd of categories[cat].sort()) {
      t += `╠ ${prefix}${cmd}\n`;
    }
    t += `╚═══════════════════╝\n`;
  }
  t += `\n${settings.footer}`;
  return t;
}

// THEME 2 - Double Line
function render2(info, categories, total, prefix) {
  let t = `══════════════════════════\n`;
  t += `     ${info.botName}\n`;
  t += `     𝙿𝚘𝚠𝚎𝚛𝚎𝚍 𝚋𝚢 𝚁𝚘𝚍𝚐𝚎𝚛𝚜\𝚗`;
  t += `══════════════════════════\n\n`;
  t += `Owner      : ${info.owner}\n`;
  t += `Prefix     : ${prefix}\n`;
  t += `User       : ${info.user}\n`;
  t += `Mode       : ${info.mode}\n`;
  t += `Uptime     : ${info.uptime}\n`;
  t += `RAM        : ${info.ram} MB\n`;
  t += `Platform   : ${info.platform}\n`;
  t += `Node       : ${info.node}\n`;
  t += `Commands   : ${total}\n`;
  t += `Time       : ${info.time}\n`;

  for (const cat of Object.keys(categories).sort()) {
    t += `\n──── ${cat} ────\n`;
    for (const cmd of categories[cat].sort()) {
      t += `  ${prefix}${cmd}\n`;
    }
  }
  t += `\n${settings.footer}`;
  return t;
}

// THEME 3 - Minimal
function render3(info, categories, total, prefix) {
  let t = `${info.botName}\n─────────────\n\n`;
  t += `Owner   ${info.owner}\n`;
  t += `Prefix  ${prefix}\n`;
  t += `User    ${info.user}\n`;
  t += `Mode    ${info.mode}\n`;
  t += `Uptime  ${info.uptime}\n`;
  t += `RAM     ${info.ram} MB\n`;
  t += `Node    ${info.node}\n`;
  t += `Cmds    ${total}\n`;
  t += `Time    ${info.time}\n`;

  for (const cat of Object.keys(categories).sort()) {
    t += `\n${cat.toLowerCase()}\n`;
    for (const cmd of categories[cat].sort()) {
      t += `  ${prefix}${cmd}\n`;
    }
  }
  t += `\n${settings.footer}`;
  return t;
}

// THEME 4 - Bracketed
function render4(info, categories, total, prefix) {
  let t = `[ ${info.botName} ]\n=============\n\n`;
  t += `[ Owner ] ${info.owner}\n`;
  t += `[ Prefix ] ${prefix}\n`;
  t += `[ User ] ${info.user}\n`;
  t += `[ Mode ] ${info.mode}\n`;
  t += `[ Uptime ] ${info.uptime}\n`;
  t += `[ RAM ] ${info.ram} MB\n`;
  t += `[ Platform ] ${info.platform}\n`;
  t += `[ Node ] ${info.node}\n`;
  t += `[ Commands ] ${total}\n`;
  t += `[ Time ] ${info.time}\n`;

  for (const cat of Object.keys(categories).sort()) {
    t += `\n[ ${cat} ]\n`;
    for (const cmd of categories[cat].sort()) {
      t += `> ${prefix}${cmd}\n`;
    }
  }
  t += `\n${settings.footer}`;
  return t;
}

// THEME 5 - Starred
function render5(info, categories, total, prefix) {
  let t = `* ${info.botName} *\n* * * * * * *\n\n`;
  t += `Owner: ${info.owner}\n`;
  t += `Prefix: ${prefix}\n`;
  t += `User: ${info.user}\n`;
  t += `Mode: ${info.mode}\n`;
  t += `Uptime: ${info.uptime}\n`;
  t += `RAM: ${info.ram} MB\n`;
  t += `Platform: ${info.platform}\n`;
  t += `Node: ${info.node}\n`;
  t += `Commands: ${total}\n`;
  t += `Time: ${info.time}\n`;

  for (const cat of Object.keys(categories).sort()) {
    t += `\n=== ${cat} ===\n`;
    for (const cmd of categories[cat].sort()) {
      t += `* ${prefix}${cmd}\n`;
    }
  }
  t += `\n${settings.footer}`;
  return t;
}

// THEME 6 - Arrow
function render6(info, categories, total, prefix) {
  let t = `>> ${info.botName} <<\n----------------\n\n`;
  t += `> Owner: ${info.owner}\n`;
  t += `> Prefix: ${prefix}\n`;
  t += `> User: ${info.user}\n`;
  t += `> Mode: ${info.mode}\n`;
  t += `> Uptime: ${info.uptime}\n`;
  t += `> RAM: ${info.ram} MB\n`;
  t += `> Platform: ${info.platform}\n`;
  t += `> Node: ${info.node}\n`;
  t += `> Commands: ${total}\n`;
  t += `> Time: ${info.time}\n`;

  for (const cat of Object.keys(categories).sort()) {
    t += `\n[ ${cat} ]\n`;
    for (const cmd of categories[cat].sort()) {
      t += `-> ${prefix}${cmd}\n`;
    }
  }
  t += `\n${settings.footer}`;
  return t;
}

// THEME 7 - Dotted
function render7(info, categories, total, prefix) {
  let t = `.....................\n   ${info.botName}\n.....................\n\n`;
  t += `Owner . . . . ${info.owner}\n`;
  t += `Prefix . . . . ${prefix}\n`;
  t += `User . . . . ${info.user}\n`;
  t += `Mode . . . . ${info.mode}\n`;
  t += `Uptime . . . . ${info.uptime}\n`;
  t += `RAM . . . . ${info.ram} MB\n`;
  t += `Platform . . . . ${info.platform}\n`;
  t += `Node . . . . ${info.node}\n`;
  t += `Commands . . . . ${total}\n`;
  t += `Time . . . . ${info.time}\n`;

  for (const cat of Object.keys(categories).sort()) {
    t += `\n. . . . ${cat} . . . .\n`;
    for (const cmd of categories[cat].sort()) {
      t += `  ${prefix}${cmd}\n`;
    }
  }
  t += `\n${settings.footer}`;
  return t;
}

// THEME 8 - Double Bracket PREMIUM
function render8(info, categories, total, prefix) {
  let t = `╔══════════════════════════╗\n`;
  t += `║  ${info.botName}\n`;
  t += `║  Premium Edition\n`;
  t += `╚══════════════════════════╝\n\n`;
  t += `» Owner    : ${info.owner}\n`;
  t += `» Prefix   : ${prefix}\n`;
  t += `» User     : ${info.user}\n`;
  t += `» Mode     : ${info.mode}\n`;
  t += `» Uptime   : ${info.uptime}\n`;
  t += `» RAM      : ${info.ram} MB\n`;
  t += `» Platform : ${info.platform}\n`;
  t += `» Node     : ${info.node}\n`;
  t += `» Commands : ${total}\n`;
  t += `» Time     : ${info.time}\n`;

  for (const cat of Object.keys(categories).sort()) {
    t += `\n╔══ [ ${cat} ] ══╗\n`;
    for (const cmd of categories[cat].sort()) {
      t += `║ » ${prefix}${cmd}\n`;
    }
    t += `╚══════════════════════════╝\n`;
  }
  t += `\n${settings.footer}`;
  return t;
}

// THEME 9 - Ornate Crown PREMIUM
function render9(info, categories, total, prefix) {
  let t = `╭━━━━━━━━━━━━━━━━━━━━━━━━╮\n`;
  t += `┃ ◇ ${info.botName} ◇\n`;
  t += `┃ Premium Edition\n`;
  t += `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
  t += `◇ Owner    : ${info.owner}\n`;
  t += `◇ Prefix   : ${prefix}\n`;
  t += `◇ User     : ${info.user}\n`;
  t += `◇ Mode     : ${info.mode}\n`;
  t += `◇ Uptime   : ${info.uptime}\n`;
  t += `◇ RAM      : ${info.ram} MB\n`;
  t += `◇ Platform : ${info.platform}\n`;
  t += `◇ Node     : ${info.node}\n`;
  t += `◇ Commands : ${total}\n`;
  t += `◇ Time     : ${info.time}\n`;

  for (const cat of Object.keys(categories).sort()) {
    t += `\n╭━━━◇ [ ${cat} ] ◇━━━╮\n`;
    for (const cmd of categories[cat].sort()) {
      t += `┃ ◇ ${prefix}${cmd}\n`;
    }
    t += `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
  }
  t += `\n${settings.footer}`;
  return t;
}

// THEME 10 - Gradient Frame PREMIUM
function render10(info, categories, total, prefix) {
  let t = `░▒▓█ ${info.botName} █▓▒░\n`;
  t += `░▒▓ Premium Edition ▓▒░\n`;
  t += `══════════════════════════\n\n`;
  t += `▪ Owner    : ${info.owner}\n`;
  t += `▪ Prefix   : ${prefix}\n`;
  t += `▪ User     : ${info.user}\n`;
  t += `▪ Mode     : ${info.mode}\n`;
  t += `▪ Uptime   : ${info.uptime}\n`;
  t += `▪ RAM      : ${info.ram} MB\n`;
  t += `▪ Platform : ${info.platform}\n`;
  t += `▪ Node     : ${info.node}\n`;
  t += `▪ Commands : ${total}\n`;
  t += `▪ Time     : ${info.time}\n`;

  for (const cat of Object.keys(categories).sort()) {
    t += `\n░▒▓ ${cat} ▓▒░\n`;
    for (const cmd of categories[cat].sort()) {
      t += `▪ ${prefix}${cmd}\n`;
    }
  }
  t += `\n══════════════════════════\n`;
  t += `${settings.footer}`;
  return t;
}

const RENDERERS = {
  1: render1, 2: render2, 3: render3, 4: render4, 5: render5,
  6: render6, 7: render7, 8: render8, 9: render9, 10: render10
};

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'menu',
  aliases: ['help', 'allmenu', 'cmds'],
  category: 'general',
  description: 'Show all available commands',
  usage: '.menu',
  react: '👑',

  async execute(conn, mek, args, chatId, isOwner) {
    // React
    try {
      const randomReact = MENU_REACTIONS[Math.floor(Math.random() * MENU_REACTIONS.length)];
      await conn.sendMessage(chatId, { react: { text: randomReact, key: mek.key } });
    } catch (e) {}

    // Build info
    const pushName = mek.pushName || 'User';
    const info = infoLines(pushName);
    const { categories, total } = buildCategories();
    const prefix = settings.prefix || '.';

    // Theme
    let themeNum = 1;
    try {
      themeNum = ui.getTheme();
    } catch (e) {
      console.log('[MENU] Theme read failed:', e.message);
    }

    const renderer = RENDERERS[themeNum] || RENDERERS[1];
    let menuText = '';
    try {
      menuText = renderer(info, categories, total, prefix);
    } catch (e) {
      console.log('[MENU] Render failed:', e.message);
      menuText = `Menu error. Theme: ${themeNum}`;
    }

    // Image
    let themeImage = null;
    try {
      if (settings.menuThemes && settings.menuThemes[themeNum] && settings.menuThemes[themeNum].image) {
        themeImage = settings.menuThemes[themeNum].image;
      }
    } catch (e) {}

    if (themeImage) {
      try {
        const buffer = await fetchImageBuffer(themeImage);
        await conn.sendMessage(chatId, {
          image: buffer,
          caption: menuText
        });
        return;
      } catch (imgErr) {
        console.log('[MENU] Image failed:', imgErr.message);
      }
    }

    // Text fallback
    try {
      await conn.sendMessage(chatId, { text: menuText });
    } catch (textErr) {
      console.log('[MENU] Text failed:', textErr.message);
    }
  }
};