/**
 * NEXORA MD - Compliment
 * Random compliment for a mentioned user
 * Usage: .compliment @user
 */

const settings = require('../../settings');

const COMPLIMENTS = [
  'has a smile that could light up a room.',
  'is the kind of person everyone is lucky to know.',
  'makes the world a better place just by being in it.',
  'has a heart of gold and a mind of steel.',
  'is proof that good people still exist.',
  'could brighten anyone\'s worst day.',
  'has the kind of energy that makes you feel at home.',
  'is absolutely crushing it at life.',
  'deserves every good thing that comes their way.',
  'is the definition of grace under pressure.',
  'has a laugh that\'s contagious.',
  'is one of a kind — and the world is better for it.',
  'has style, substance, and sass.',
  'inspires everyone around them without even trying.',
  'is the person you call when you need to feel better.'
];

function cleanNum(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

module.exports = {
  name: 'compliment',
  aliases: ['praise', 'nice'],
  category: 'fun',
  description: 'Compliment a user',
  usage: '.compliment @user',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      if (mentioned.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Mention someone. Example: ${settings.prefix || '.'}compliment @user\n\n${settings.footer}`
        });
        return;
      }

      const target = mentioned[0];
      const targetNum = cleanNum(target);
      const msg = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `@${targetNum} ${msg}\n\n${settings.footer}`,
        mentions: [target]
      });

    } catch (error) {
      console.log('[COMPLIMENT] Error:', error.message);
    }
  }
};