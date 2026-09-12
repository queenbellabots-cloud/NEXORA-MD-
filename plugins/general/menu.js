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
    try {
      const sender = mek.key.participant || mek.key.remoteJid;
      const pushName = mek.pushName || 'User';

      // React (safe)
      try {
        const randomReact = MENU_REACTIONS[Math.floor(Math.random() * MENU_REACTIONS.length)];
        await conn.sendMessage(chatId, { react: { text: randomReact, key: mek.key } });
      } catch (e) {
        console.log('[MENU] Reaction failed:', e.message);
      }

      // Build command list
      let totalCommands = 0;
      const categories = {};
      try {
        const commands = global.commands || new Map();
        const seen = new Set();
        const cmdList = [];

        for (const [name, cmd] of commands) {
          if (!cmd || !cmd.name) continue;
          if (seen.has(cmd.name)) continue;
          seen.add(cmd.name);
          cmdList.push({ name: cmd.name, category: cmd.category || 'general' });
        }

        cmdList.forEach(cmd => {
          const cat = String(cmd.category).toUpperCase();
          if (!categories[cat]) categories[cat] = [];
          categories[cat].push(cmd.name);
        });

        totalCommands = cmdList.length;
      } catch (e) {
        console.log('[MENU] Command list failed:', e.message);
      }

      const sortedCategories = Object.keys(categories).sort();
      const currentMode = global.botMode ? global.botMode.toUpperCase() : 'PUBLIC';

      // Build menu text
      let menu = '====================\n';
      menu += '        ' + (settings.botName || 'NEXORA MD') + '\n';
      menu += '   Powered by Rodgers\n';
      menu += '====================\n';
      menu += '          BOT INFO\n';
      menu += '====================\n';
      menu += 'User: ' + pushName + '\n';
      menu += 'Owner: ' + (settings.botOwner || 'Rodgers') + '\n';
      menu += 'Developer: ' + (settings.developerName || 'RODGERS') + '\n';
      menu += 'Prefix: ' + (settings.prefix || '.') + '\n';
      menu += 'Commands: ' + totalCommands + '\n';
      menu += 'Mode: ' + currentMode + '\n\n';

      menu += '====================\n';
      menu += '     COMMAND LIST\n';
      menu += '====================\n';

      for (const category of sortedCategories) {
        menu += '\n[' + category + ']\n';
        for (const cmdName of categories[category].sort()) {
          menu += '  ' + (settings.prefix || '.') + cmdName + '\n';
        }
      }

      menu += '\n====================\n';
      menu += '  Join our channel for updates.\n';
      menu += '====================\n\n';
      menu += (settings.footer || '');

      // Try sending with image first
      const menuImages = settings.menuImages || [];
      const randomImage = menuImages.length > 0
        ? menuImages[Math.floor(Math.random() * menuImages.length)]
        : null;

      const contextInfo = {
        mentionedJid: [sender],
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: settings.channelId || '',
          newsletterName: settings.channelName || 'NEXORA MD',
          serverMessageId: 1
        }
      };

      if (randomImage) {
        try {
          await conn.sendMessage(chatId, {
            image: { url: randomImage },
            caption: menu,
            contextInfo
          });
          return;
        } catch (imageErr) {
          console.log('[MENU] Image failed:', imageErr.message);
        }
      }

      // Fallback to text
      await conn.sendMessage(chatId, {
        text: menu,
        contextInfo
      });

    } catch (error) {
      console.log('[MENU] Fatal error:', error.message, error.stack);
      try {
        await conn.sendMessage(chatId, {
          text: 'Menu error: ' + error.message
        });
      } catch (e) {}
    }
  }
};