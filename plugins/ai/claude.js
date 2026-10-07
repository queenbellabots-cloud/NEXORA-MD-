/**
 * NEXORA MD - Claude AI
 * AI chat via Omegatech Claude endpoint
 * Usage:
 *   .claude <question>
 *   .claude <question> (reply to a message)
 */

const settings = require('../../settings');
const axios = require('axios');

const API_URL = 'https://api.omegatech.app/api/ai/Claude';

// ═══════════════════════════════════════════════════════
// REPLY PARSER
// ═══════════════════════════════════════════════════════
function extractReply(data) {
  if (!data) return null;

  const candidate =
    data?.result ||
    data?.reply ||
    data?.response ||
    data?.message ||
    data?.answer ||
    data?.text ||
    data?.data?.result ||
    data?.data?.reply ||
    (typeof data === 'string' ? data : null);

  if (!candidate || typeof candidate !== 'string') return null;
  return candidate.trim();
}

module.exports = {
  name: 'claude',
  aliases: ['claudeai', 'anthropic'],
  category: 'ai',
  description: 'Chat with Claude AI',
  usage: '.claude <question>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      let question = args.join(' ').trim();

      if (!question) {
        const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted) {
          question =
            quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            quoted.imageMessage?.caption ||
            quoted.videoMessage?.caption ||
            '';
          question = question.trim();
        }
      }

      if (!question) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Claude AI\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}claude <question>\n` +
            `  Reply to a message with ${settings.prefix || '.'}claude\n\n` +
            `Example: ${settings.prefix || '.'}claude Tell me a story\n\n` +
            `${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Thinking...` });

      const url = `${API_URL}?text=${encodeURIComponent(question)}`;

      console.log('[CLAUDE] Requesting');

      let data = null;
      try {
        const res = await axios.get(url, {
          timeout: 45000,
          headers: { 'Accept': 'application/json' }
        });
        data = res.data;
      } catch (e) {
        console.log('[CLAUDE] API error:', e.message);
      }

      const reply = extractReply(data);

      if (!reply) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `AI service returned no reply. Try again.\n\n${settings.footer}`
        });
        return;
      }

      const cleanReply = reply.replace(/\*\*/g, '*').trim();

      const MAX_LEN = 4000;
      const rawSend = global.rawSendMessage || conn.sendMessage.bind(conn);

      if (cleanReply.length > MAX_LEN) {
        const chunks = [];
        for (let i = 0; i < cleanReply.length; i += MAX_LEN) {
          chunks.push(cleanReply.slice(i, i + MAX_LEN));
        }
        for (let i = 0; i < chunks.length; i++) {
          const label = chunks.length > 1 ? `\n\n(Part ${i + 1}/${chunks.length})` : '';
          await rawSend(chatId, { text: chunks[i] + label });
          await new Promise(r => setTimeout(r, 500));
        }
      } else {
        await rawSend(chatId, { text: cleanReply });
      }

      console.log('[CLAUDE] Replied');

    } catch (error) {
      console.log('[CLAUDE] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};