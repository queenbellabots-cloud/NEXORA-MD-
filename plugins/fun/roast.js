/**
 * NEXORA MD - Roast
 * Random roast for a mentioned user
 * Usage: .roast @user
 */

const settings = require('../../settings');

const ROASTS = [
  'is the reason the shampoo bottle has instructions.',
  'has the perfect face for radio.',
  'is like a cloud — when they disappear, it\'s a beautiful day.',
  'couldn\'t pour water out of a boot with instructions on the heel.',
  'is proof that evolution can go in reverse.',
  'brings everyone joy — when they leave the room.',
  'is a few fries short of a Happy Meal.',
  'has an entire tree of life, all the leaves are just oxygen.',
  'is the human version of a participation trophy.',
  'isn\'t the dumbest person alive, but they better hope that person doesn\'t die.',
  'reminds me of a penny — two-faced and not worth picking up.',
  'has their head so far in the clouds, they forgot how to breathe.',
  'is like a software update — every time they speak, I think "not now".',
  'is the reason they put instructions on toothpaste.',
  'has something on their mind — I just hope it\'s not contagious.'
];

function cleanNum(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

module.exports = {
  name: 'roast',
  aliases: ['insult'],
  category: 'fun',
  description: 'Roast a user',
  usage: '.roast @user',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      if (mentioned.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Mention someone. Example: ${settings.prefix || '.'}roast @user\n\n${settings.footer}`
        });
        return;
      }

      const target = mentioned[0];
      const targetNum = cleanNum(target);
      const roast = ROASTS[Math.floor(Math.random() * ROASTS.length)];

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `@${targetNum} ${roast}\n\n${settings.footer}`,
        mentions: [target]
      });

    } catch (error) {
      console.log('[ROAST] Error:', error.message);
    }
  }
};