/**
 * NEXORA MD - Algolia AI
 * AI chat via Omegatech Algolia endpoint
 * Usage:
 *   .algolia <question>
 *   .algolia <question> (reply to a message)
 */

const settings = require('../../settings');
const axios = require('axios');

const API_URL = 'https://api.omegatech.app/api/ai/Algolia';

// Persistent session per user (if API returns one)
const userSessions = new Map();

// ═══════════════════════════════════════════════════════
// FLEXIBLE REPLY PARSER — handles every known shape
// ═══════════════════════════════════════════════════════
function extractReply(data) {
  if (!data) return null;

  let candidate =
    data?.reply ||
    data?.response ||
    data?.message ||
    data?.result ||
    data?.answer ||
    data?.text ||
    data?.data?.reply ||
    data?.data?.response ||
    data?.data?.message ||
    data?.data?.answer ||
    (typeof data === 'string' ? data : null);

  if (!candidate || typeof candidate !== 'string') return null;

  // Handle nested JSON-in-string case
  // Example: "{\"reply\":\"...\",\"sessionId\":\"...\"}"
  if (candidate.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed?.reply && typeof parsed.reply === 'string') {
        candidate = parsed.reply;
        if (parsed.sessionId) data.__sessionId = parsed.sessionId;
      } else if (parsed?.response && typeof parsed.response === 'string') {
        candidate = parsed.response;
      } else if (parsed?.message && typeof parsed.message === 'string') {
        candidate = parsed.message;
      }
    } catch (e) {}
  }

  return candidate.trim();
}

module.exports = {
  name: 'algolia',
  aliases: ['algo', 'algoliaai'],
  category: 'ai',
  description: 'AI chat via Algolia',
  usage: '.algolia <question>',
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
            `Algolia AI\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}algolia <question>\n` +
            `  Reply to a message with ${settings.prefix || '.'}algolia\n\n` +
            `Example: ${settings.prefix || '.'}algolia What is machine learning?\n\n` +
            `${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Thinking...` });

      const sender = mek.key.participant || mek.key.remoteJid;
      const senderNum = sender.split('@')[0].split(':')[0];

      // Optional session continuity
      const existingSession = userSessions.get(senderNum);
      const sessionParam = existingSession ? `&sessionId=${existingSession}` : '';

      const url = `${API_URL}?action=chat&prompt=${encodeURIComponent(question)}${sessionParam}`;

      console.log('[ALGOLIA] Requesting:', url.split('&prompt=')[0]);

      let data = null;
      try {
        const res = await axios.get(url, {
          timeout: 45000,
          headers: { 'Accept': 'application/json' }
        });
        data = res.data;
      } catch (e) {
        console.log('[ALGOLIA] API error:', e.message);
      }

      const reply = extractReply(data);

      if (!reply) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `AI service returned no reply. Try again.\n\n${settings.footer}`
        });
        return;
      }

      // Save session if API returned one
      if (data?.__sessionId) {
        userSessions.set(senderNum, data.__sessionId);
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

      console.log(`[ALGOLIA] Replied to ${senderNum}`);

    } catch (error) {
      console.log('[ALGOLIA] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};