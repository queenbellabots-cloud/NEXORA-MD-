const settings = require('../../settings');
const mode = require('../../lib/mode');

module.exports = {
  name: 'mode',
  aliases: ['botmode'],
  category: 'owner',
  description: 'Switch between public and private mode',
  usage: '.mode public | .mode private',
  ownerOnly: true,
  react: '✅',
  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const choice = (args[0] || '').toLowerCase();
      const current = mode.getMode(settings.mode || 'public');

      if (choice !== 'public' && choice !== 'private') {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Current mode: ${current.toUpperCase()}

Usage:
.mode public - anyone can use commands
.mode private - only owner can use commands

${settings.footer}`
        });
        return;
      }

      const ok = mode.setMode(choice);
      if (!ok) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      await conn.sendMessage(chatId, {
        text: `Bot mode set to: ${choice.toUpperCase()}

${choice === 'private' ? 'Non-owner commands are now silently ignored.' : 'Everyone can now use commands.'}

${settings.footer}`
      });
    } catch (error) {
      await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Error: ${error.message}` });
    }
  }
};