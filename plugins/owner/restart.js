const settings = require('../../settings');

module.exports = {
  name: 'restart',
  aliases: ['reboot'],
  category: 'owner',
  description: 'Restart the bot',
  usage: '.restart',
  ownerOnly: true,
  react: '✅',
  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `Restarting NEXORA MD...\n\n${settings.footer}`
      });

      setTimeout(() => process.exit(0), 1500);
    } catch (error) {
      await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
    }
  }
};