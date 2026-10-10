/**
 * NEXORA MD - Hello Command
 * Simplest possible command — proves the pipeline works
 * Usage: .hello
 */

const settings = require('../../settings');

module.exports = {
  name: 'hello',
  aliases: ['hi', 'hey'],
  category: 'general',
  description: 'Says hello',
  usage: '.hello',
  react: '👋',

  async execute(conn, mek, args, chatId, isOwner) {
    const name = mek.pushName || 'there';
    const time = new Date().toLocaleString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    await conn.sendMessage(chatId, {
      text:
        `👋 Hello, ${name}!\n\n` +
        `🕐 Time: ${time}\n` +
        `🤖 Bot: ${settings.botName || 'NEXORA MD'}\n` +
        `📡 Status: Online and working\n\n` +
        `${settings.footer || ''}`
    }, { quoted: mek });
  }
};