/**
 * NEXORA MD - AI All
 * Multi-model AI chat via Omegatech All-Ai endpoint
 * Usage:
 *   .aiall <question>
 *   .aiall <question> (reply to a message)
 */

const settings = require('../../settings');
const axios = require('axios');

const API_URL = 'https://api.omegatech.app/api/ai/All-Ai';

// Persistent session per user
const userSessions = new Map();

function extractReply(data) {
  if (!data) return null;

  let candidate =
    data?.reply ||
    data?.response ||
    data?.message ||
    data?.result ||
    data?.answer ||
    data?.data?.reply ||
    data?.data?.response ||
    (typeof data === 'string' ? data : null);

  if (!candidate || typeof candidate !== 'string') return null;

  // Some Omegatech endpoints nest reply inside a JSON string
  // Example: "{\"reply\":\"Halo! ...\",\"sessionId\":\"...\"}"
  if (candidate.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed?.reply && typeof parsed.reply === 'string') {
        candidate = parsed.reply;
        // Save session if present
        if (parsed.sessionId) {
          data.__sessionId = parsed.sessionId;
        }
      }
    } catch (e) {}
  }

  return candidate.trim();
}

module.exports = {
  name: 'aiall',
  aliases: ['allai', 'nexai', 'askai'],
  category: 'ai',
  description: 'Multi-model AI chat',
  usage: '.aiall <question>',
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
            `AI All\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}aiall <question>\n` +
            `  Reply to a message with ${settings.prefix || '.'}aiall\n\n` +
            `Example: ${settings.prefix || '.'}aiall What is quantum physics?\n\n` +
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

      const url = `${API_URL}?action=chat&message=${encodeURIComponent(question)}${sessionParam}`;

      console.log('[AIALL] Requesting:', url.split('&message=')[0]);

      let data = null;
      try {
        const res = await axios.get(url, {
          timeout: 45000,
          headers: { 'Accept': 'application/json' }
        });
        data = res.data;
      } catch (e) {
        console.log('[AIALL] API error:', e.message);
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

      const model = data?.model ? ` [${data.model}]` : '';
      const cleanReply = reply.replace(/\*\*/g, '*').trim();

      const MAX_LEN = 4000;
      if (cleanReply.length > MAX_LEN) {
        const chunks = [];
        for (let i = 0; i < cleanReply.length; i += MAX_LEN) {
          chunks.push(cleanReply.slice(i, i + MAX_LEN));
        }
        for (let i = 0; i < chunks.length; i++) {
          const label = chunks.length > 1 ? `\n\n(Part ${i + 1}/${chunks.length})` : '';
          const rawSend = global.rawSendMessage || conn.sendMessage.bind(conn);
          await rawSend(chatId, { text: chunks[i] + label });
          await new Promise(r => setTimeout(r, 500));
        }
      } else {
        const rawSend = global.rawSendMessage || conn.sendMessage.bind(conn);
        await rawSend(chatId, { text: cleanReply + model });
      }

      console.log(`[AIALL] Replied to ${senderNum} via ${data?.model || 'unknown'}`);

    } catch (error) {
      console.log('[AIALL] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};