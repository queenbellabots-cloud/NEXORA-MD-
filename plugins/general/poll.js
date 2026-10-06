/**
 * NEXORA MD - Poll
 * Create a WhatsApp poll in the current chat
 * Usage: .poll Question | Option1 | Option2 | Option3
 */

const settings = require('../../settings');

module.exports = {
  name: 'poll',
  aliases: ['vote'],
  category: 'general',
  description: 'Create a WhatsApp poll',
  usage: '.poll Question | Opt1 | Opt2 | Opt3',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const input = args.join(' ').trim();

      if (!input.includes('|')) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Create a poll\n\n` +
            `Usage: ${settings.prefix || '.'}poll Question | Opt1 | Opt2 | Opt3\n\n` +
            `Example:\n` +
            `  ${settings.prefix || '.'}poll Best day? | Friday | Saturday | Sunday\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const parts = input.split('|').map(s => s.trim()).filter(Boolean);
      if (parts.length < 3) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Need a question + at least 2 options separated by |\n\n${settings.footer}`
        });
        return;
      }

      const question = parts[0];
      const options = parts.slice(1);

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      try {
        await conn.sendMessage(chatId, {
          poll: {
            name: question,
            values: options,
            selectableCount: 1
          }
        });
        console.log('[POLL] Created:', question);
      } catch (pollErr) {
        console.log('[POLL] Failed:', pollErr.message);
        // Fallback: send as text
        let text = `POLL\n\n${question}\n\n`;
        options.forEach((opt, i) => {
          text += `${i + 1}. ${opt}\n`;
        });
        text += `\n${settings.footer}`;
        await conn.sendMessage(chatId, { text });
      }

    } catch (error) {
      console.log('[POLL] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
    }
  }
};