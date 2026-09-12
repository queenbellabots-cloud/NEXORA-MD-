/**
 * NEXORA MD - Menu Command
 * Safe version: never crashes on image or command list errors
 */

const settings = require('../../settings');

const MENU_REACTIONS = ['👑', '✨', '🌟', '🔥', '💫', '⭐', '🎯', '🚀', '💎', '🎉'];

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

      commands.forEach((cmd, key) => {
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
      const sender = mek.key.participant || mek.key.remoteJid;
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
    // 4. SEND (image first, text fallback)
    // ─────────────────────────────────────────────
    let contextInfo = {};
    try {
      const sender = mek.key.participant || mek.key.remoteJid;
      contextInfo = {
        mentionedJid: [sender],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: settings.channelId || '',
          newsletterName: settings.channelName || 'NEXORA MD',
          serverMessageId: 1
        }
      };
    } catch (e) {
      console.log('[MENU] contextInfo failed:', e.message);
    }

    // Try image
    let imageUrl = null;
    try {
      const menuImages = Array.isArray(settings.menuImages) ? settings.menuImages : [];
      if (menuImages.length > 0) {
        imageUrl = menuImages[Math.floor(Math.random() * menuImages.length)];
      }
    } catch (e) {
      console.log('[MENU] Image pick failed:', e.message);
    }

    if (imageUrl) {
      try {
        await conn.sendMessage(chatId, {
          image: { url: imageUrl },
          caption: menu,
          contextInfo
        });
        return;
      } catch (imageErr) {
        console.log('[MENU] Image send failed:', imageErr.message);
        console.log('[MENU] Falling back to text...');
      }
    }

    // Fallback to text
    try {
      await conn.sendMessage(chatId, {
        text: menu,
        contextInfo
      });
    } catch (textErr) {
      console.log('[MENU] Text send failed:', textErr.message);
      // Last resort: plain text, no contextInfo
      try {
        await conn.sendMessage(chatId, { text: menu });
      } catch (finalErr) {
        console.log('[MENU] Final fallback failed:', finalErr.message);
      }
    }
  }
};