/**
 * NEXORA MD - Flirt
 * Random flirty line
 * Usage: .flirt @user OR .flirt <name>
 */

const settings = require('../../settings');

const FLIRTS = [
  'Are you a magician? Because whenever I look at you, everyone else disappears.',
  'Do you have a map? I keep getting lost in your eyes.',
  'Are you a parking ticket? Because you\'ve got FINE written all over you.',
  'If you were a vegetable, you\'d be a cute-cumber.',
  'Are you a Wi-Fi signal? Because I\'m feeling a strong connection.',
  'Do you believe in love at first sight, or should I walk by again?',
  'Your hand looks heavy — can I hold it for you?',
  'Are you made of copper and tellurium? Because you\'re Cu-Te.',
  'If beauty were time, you\'d be eternity.',
  'Is your name Google? Because you have everything I\'ve been searching for.',
  'Are you a time traveler? Because I see you in my future.',
  'Do you have a Band-Aid? Because I just scraped my knee falling for you.',
  'You must be a broom, because you just swept me off my feet.',
  'Can I follow you home? My parents always told me to follow my dreams.',
  'If you were a star, you\'d be the brightest one in the sky.'
];

function cleanNum(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

module.exports = {
  name: 'flirt',
  aliases: ['pickupline'],
  category: 'fun',
  description: 'Send a random flirty line',
  usage: '.flirt @user',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const flirt = FLIRTS[Math.floor(Math.random() * FLIRTS.length)];

      let targetText = '';
      let mentions = [];

      if (mentioned.length > 0) {
        const target = mentioned[0];
        const targetNum = cleanNum(target);
        targetText = `@${targetNum} `;
        mentions = [target];
      } else if (args.length > 0) {
        targetText = `${args.join(' ')}: `;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `${targetText}${flirt}\n\n${settings.footer}`,
        mentions
      });

    } catch (error) {
      console.log('[FLIRT] Error:', error.message);
    }
  }
};