/**
 * NEXORA MD - Read More
 * Send a message with a "Read more" fold
 * Usage: .readmore Title | Hidden content here
 */

const settings = require('../../settings');

module.exports = {
  name: 'readmore',
  aliases: ['fold', 'expand'],
  category: 'general',
  description: 'Send a collapsible message',
  usage: '.readmore Title | Hidden content',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const input = args.join(' ').trim();

      if (!input.includes('|')) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Read More\n\n` +
            `Usage: ${settings.prefix || '.'}readmore Title | Hidden content\n\n` +
            `Example:\n` +
            `  ${settings.prefix || '.'}readmore Click here | This is the hidden part\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const [title, ...rest] = input.split('|');
      const hidden = rest.join('|').trim();

      const finalText = `${title.trim()}\n${'\u200B'.repeat(4000)}\n${hidden}`;

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: finalText });

    } catch (error) {
      console.log('[READMORE] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
    }
  }
};