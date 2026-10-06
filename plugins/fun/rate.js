/**
 * NEXORA MD - Rate
 * Rate anything 1-10
 * Usage: .rate <thing>
 */

const settings = require('../../settings');

function hashScore(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 10 + 1;
}

module.exports = {
  name: 'rate',
  aliases: ['score'],
  category: 'fun',
  description: 'Rate anything from 1 to 10',
  usage: '.rate <thing>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const thing = args.join(' ').trim();

      if (!thing) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Rate something. Example: ${settings.prefix || '.'}rate pizza\n\n${settings.footer}`
        });
        return;
      }

      const score = hashScore(thing);
      const bar = '★'.repeat(score) + '☆'.repeat(10 - score);

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `RATING\n\n` +
          `Thing: ${thing}\n` +
          `Score: ${score}/10\n` +
          `${bar}\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[RATE] Error:', error.message);
    }
  }
};