/**
 * NEXORA MD - Menu Command
 * Safe version: image via axios buffer, no channel branding
 */

const settings = require('../../settings');
const axios = require('axios');

const MENU_REACTIONS = ['👑', '✨', '🌟', '🔥', '💫', '⭐', '🎯', '🚀', '💎', '🎉'];

// Fetch image as buffer with a browser user-agent
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

module.exports = {
  name: 'menu',
  aliases: ['help', 'allmenu', 'cmds'],
  category: 'general',
  description: 'Show all available commands',
  usage: '.menu',
  react: '👑',

  async execute(conn, mek, args, chatId, isOwner) {
    // ─────────────────────────────────────────────
    // 1. SAFE REACTION
    // ─────────────────────────────────────────────
    try {
      const randomReact = MENU_REACTIONS[Math.floor(Math.random() * MENU_REACTIONS.length)];
      await conn.sendMessage(chatId, {
        react: { text: randomReact, key: mek.key }
      });
    } catch (e) {
      console.log('[MENU] Reaction failed:', e.message);
    }

    // ─────────────────────────────────────────────
    // 2. SAFE COMMAND LIST
    // ─────────────────────────────────────────────
    let totalCommands = 0;
    const categories = {};

    try {
      const commands = global.commands;
      if (!commands || typeof commands.forEach !== 'function') {
        throw new Error('global.commands is not a Map');
      }

      const seen = new Set();
      const cmdList = [];

      commands.forEach((cmd) => {
        try {
          if (!cmd || typeof cmd !== 'object') return;
          if (!cmd.name || typeof cmd.name !== 'string') return;
          if (seen.has(cmd.name)) return;
          seen.add(cmd.name);
          cmdList.push({
            name: cmd.name,
            category: (typeof cmd.category === 'string' && cmd.category)
              ? cmd.category
              : 'general'
          });
        } catch (innerErr) {
          console.log('[MENU] Skipped bad command:', innerErr.message);
        }
      });

      cmdList.forEach(cmd => {
        const cat = String(cmd.category).toUpperCase();
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(cmd.name);
      });

      totalCommands = cmdList.length;
    } catch (e) {
      console.log('[MENU] Command list failed:', e.message);
    }

    // ─────────────────────────────────────────────
    // 3. BUILD MENU TEXT
    // ─────────────────────────────────────────────
    let menu = '';

    try {
      const pushName = mek.pushName || 'User';
      const sortedCategories = Object.keys(categories).sort();
      const currentMode = global.botMode
        ? String(global.botMode).toUpperCase()
        : 'PUBLIC';

      const botName = settings.botName || 'NEXORA MD';
      const botOwner = settings.botOwner || 'Rodgers';
      const devName = settings.developerName || 'RODGERS';
      const prefix = settings.prefix || '.';
      const footer = settings.footer || '';

      menu += '====================\n';
      menu += '   ' + botName + '\n';
      menu += '   Powered by Rodgers\n';
      menu += '====================\n';
      menu += '       BOT INFO\n';
      menu += '====================\n';
      menu += 'User: ' + pushName + '\n';
      menu += 'Owner: ' + botOwner + '\n';
      menu += 'Developer: ' + devName + '\n';
      menu += 'Prefix: ' + prefix + '\n';
      menu += 'Commands: ' + totalCommands + '\n';
      menu += 'Mode: ' + currentMode + '\n\n';

      menu += '====================\n';
      menu += '   COMMAND LIST\n';
      menu += '====================\n';

      if (sortedCategories.length === 0) {
        menu += '\nNo commands loaded yet.\n';
      } else {
        for (const category of sortedCategories) {
          menu += '\n[' + category + ']\n';
          const list = categories[category].slice().sort();
          for (const cmdName of list) {
            menu += '  ' + prefix + cmdName + '\n';
          }
        }
      }

      menu += '\n====================\n';
      menu += 'Join our channel for updates.\n';
      menu += '====================\n\n';
      menu += footer;
    } catch (e) {
      console.log('[MENU] Text build failed:', e.message);
      menu = 'Menu error. Check console for details.';
    }

    // ─────────────────────────────────────────────
    // 4. PICK IMAGE
    // ─────────────────────────────────────────────
    let imageUrl = null;
    try {
      const menuImages = Array.isArray(settings.menuImages) ? settings.menuImages : [];
      if (menuImages.length > 0) {
        imageUrl = menuImages[Math.floor(Math.random() * menuImages.length)];
      }
    } catch (e) {
      console.log('[MENU] Image pick failed:', e.message);
    }

    // ─────────────────────────────────────────────
    // 5. SEND (buffer image first, then plain text)
    // ─────────────────────────────────────────────
    if (imageUrl) {
      try {
        const buffer = await fetchImageBuffer(imageUrl);
        await conn.sendMessage(chatId, {
          image: buffer,
          caption: menu
        });
        return;
      } catch (imageErr) {
        console.log('[MENU] Image send failed:', imageErr.message);
        console.log('[MENU] Falling back to text...');
      }
    }

    // Fallback: plain text, no forwarding context
    try {
      await conn.sendMessage(chatId, { text: menu });
    } catch (textErr) {
      console.log('[MENU] Text send failed:', textErr.message);
    }
  }
};