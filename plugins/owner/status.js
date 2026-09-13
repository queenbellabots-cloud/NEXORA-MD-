/**
 * NEXORA MD - Post Text Status
 * Usage: .status <text>
 */

const settings = require('../../settings');

module.exports = {
  name: 'status',
  aliases: ['setstatus', 'poststatus'],
  category: 'owner',
  description: 'Post a text status from the bot',
  usage: '.status <text>',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const text = args.join(' ').trim();
      if (!text) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Post a text status\n\n` +
            `Usage: ${settings.prefix || '.'}status <your message>\n\n` +
            `${settings.footer}`
        });
        return;
      }

      await conn.sendMessage('status@broadcast', { text });
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `Text status posted.\n\n${settings.footer}`
      });

    } catch (error) {
      console.log('[STATUS] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};