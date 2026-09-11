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

      const randomReact = MENU_REACTIONS[Math.floor(Math.random() * MENU_REACTIONS.length)];
      await conn.sendMessage(chatId, {
        react: { text: randomReact, key: mek.key }
      });

      const commands = global.commands || new Map();
      const cmdList = [];
      const seen = new Set();

      for (const [name, cmd] of commands) {
        if (!seen.has(name) && cmd.name === name) {
          seen.add(name);
          cmdList.push({ name, category: cmd.category || 'general' });
        }
      }

      const categories = {};
      cmdList.forEach(cmd => {
        const cat = cmd.category.toUpperCase();
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(cmd.name);
      });

      const totalCommands = cmdList.length;
      const sortedCategories = Object.keys(categories).sort();

      const menuImages = settings.menuImages || [];
      const randomImage = menuImages[Math.floor(Math.random() * menuImages.length)];

      const currentMode = global.botMode ? global.botMode.toUpperCase() : 'PUBLIC';

      let menu = '====================\n';
      menu += '        ' + settings.botName + '\n';
      menu += '   Powered by Rodgers\n';
      menu += '====================\n';
      menu += '          BOT INFO\n';
      menu += '====================\n';
      menu += 'User: ' + pushName + '\n';
      menu += 'Owner: ' + settings.botOwner + '\n';
      menu += 'Developer: ' + settings.developerName + '\n';
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
      menu += settings.footer;

      await conn.sendMessage(chatId, {
        image: { url: randomImage },
        caption: menu,
        contextInfo: {
          mentionedJid: [sender],
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: settings.channelId,
            newsletterName: settings.channelName,
            serverMessageId: 1
          }
        }
      });
    } catch (error) {
      console.error('Error in menu:', error);
      await conn.sendMessage(chatId, { text: 'Error loading menu. Please try again.' });
    }
  }
};