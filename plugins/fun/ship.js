/**
 * NEXORA MD - Ship
 * Calculate love compatibility between two users
 * Usage: .ship @user1 @user2
 */

const settings = require('../../settings');

function cleanNum(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function hashScore(a, b) {
  const combined = [a, b].sort().join('-');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 101;
}

function bar(pct, len = 12) {
  const filled = Math.round((pct / 100) * len);
  return '█'.repeat(filled) + '░'.repeat(len - filled);
}

module.exports = {
  name: 'ship',
  aliases: ['love', 'match'],
  category: 'fun',
  description: 'Calculate compatibility between two users',
  usage: '.ship @user1 @user2',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const sender = mek.key.participant || mek.key.remoteJid;

      if (mentioned.length < 2) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Mention two users. Example: ${settings.prefix || '.'}ship @user1 @user2\n\n${settings.footer}`
        });
        return;
      }

      const a = mentioned[0];
      const b = mentioned[1];
      const aNum = cleanNum(a);
      const bNum = cleanNum(b);

      const score = hashScore(aNum, bNum);

      let verdict = '';
      if (score >= 90) verdict = 'Perfect match!';
      else if (score >= 75) verdict = 'Great together!';
      else if (score >= 50) verdict = 'Worth a try.';
      else if (score >= 30) verdict = 'Friends at best.';
      else verdict = 'Not meant to be.';

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `LOVE CALCULATOR\n\n` +
          `@${aNum} + @${bNum}\n\n` +
          `${bar(score)} ${score}%\n\n` +
          `${verdict}\n\n` +
          `${settings.footer}`,
        mentions: [a, b]
      });

    } catch (error) {
      console.log('[SHIP] Error:', error.message);
    }
  }
};