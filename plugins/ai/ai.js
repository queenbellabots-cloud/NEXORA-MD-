/**
 * NEXORA MD - AI Chat
 * Direct AI query — works anywhere, requires prefix
 * API: Omegatech
 * Usage:
 *   .ai <question>
 *   .ai (reply to a message)
 */

const settings = require('../../settings');
const axios = require('axios');

const API_BASE = 'https://api.omegatech.xyz';

module.exports = {
  name: 'ai',
  aliases: ['ask', 'gpt', 'chat'],
  category: 'ai',
  description: 'Ask the AI anything',
  usage: '.ai <question>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      // ─────────────────────────────────────────
      // 1. Get question from args or replied message
      // ─────────────────────────────────────────
      let question = args.join(' ').trim();

      if (!question) {
        const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
        const quoted = contextInfo?.quotedMessage;

        if (quoted) {
          const text =
            quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            quoted.imageMessage?.caption ||
            quoted.videoMessage?.caption ||
            '';
          if (text) question = text.trim();
        }
      }

      if (!question) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `AI Chat\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}ai <question>\n` +
            `  Reply to a message with ${settings.prefix || '.'}ai\n\n` +
            `Examples:\n` +
            `  ${settings.prefix || '.'}ai What is quantum physics?\n` +
            `  ${settings.prefix || '.'}ai Write a short poem about rain\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 2. React and notify
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Thinking...` });

      // ─────────────────────────────────────────
      // 3. Build session ID (persistent per user)
      // ─────────────────────────────────────────
      const sender = mek.key.participant || mek.key.remoteJid;
      const senderNum = sender.split('@')[0].split(':')[0];
      const sessionId = 'nexora_' + senderNum;
      const pushName = mek.pushName || 'User';

      // ─────────────────────────────────────────
      // 4. Call Omegatech API
      // ─────────────────────────────────────────
      let reply = null;
      let lastError = null;

      // Try POST first
      try {
        console.log('[AI] Trying: Omegatech POST');

        const res = await axios.post(`${API_BASE}/ai/chat`, {
          message: question,
          sessionId,
          name: pushName
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 45000
        });

        const data = res.data;
        const candidate = data?.reply || data?.response || data?.message;

        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
          // Avoid returning echoed input
          if (candidate.trim() !== question.trim() || data?.success === true) {
            reply = candidate.trim();
            console.log('[AI] Success: Omegatech POST');
          }
        }
      } catch (e) {
        lastError = e.message;
        console.log('[AI] Omegatech POST failed:', e.message);
      }

      // Try GET fallback
      if (!reply) {
        try {
          console.log('[AI] Trying: Omegatech GET');

          const res = await axios.get(`${API_BASE}/ai/chat`, {
            params: { message: question, sessionId, name: pushName },
            timeout: 45000
          });

          const data = res.data;
          const candidate = data?.reply || data?.response || data?.message;

          if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
            reply = candidate.trim();
            console.log('[AI] Success: Omegatech GET');
          }
        } catch (e) {
          lastError = e.message;
          console.log('[AI] Omegatech GET failed:', e.message);
        }
      }

      // Fallback: Pollinations
      if (!reply) {
        try {
          console.log('[AI] Fallback: pollinations');

          const res = await axios.post('https://text.pollinations.ai/openai', {
            model: 'openai',
            messages: [
              { role: 'system', content: 'You are NEXORA, a helpful WhatsApp AI assistant. Reply naturally.' },
              { role: 'user', content: question }
            ]
          }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 45000
          });

          const candidate = res.data?.choices?.[0]?.message?.content ||
                            (typeof res.data === 'string' ? res.data : null);

          if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
            reply = candidate.trim();
            console.log('[AI] Success: pollinations');
          }
        } catch (e) {
          lastError = e.message;
          console.log('[AI] Pollinations failed:', e.message);
        }
      }

      // ─────────────────────────────────────────
      // 5. Send reply
      // ─────────────────────────────────────────
      if (!reply) {
        console.log('[AI] All endpoints failed. Last error:', lastError);
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `AI is currently unavailable. Try again later.\n\n${settings.footer}`
        });
        return;
      }

      reply = reply.replace(/\*\*/g, '*').trim();

      // Split long replies
      const MAX_LEN = 4000;
      if (reply.length > MAX_LEN) {
        const chunks = [];
        for (let i = 0; i < reply.length; i += MAX_LEN) {
          chunks.push(reply.slice(i, i + MAX_LEN));
        }
        for (let i = 0; i < chunks.length; i++) {
          const label = chunks.length > 1 ? `\n\n(Part ${i + 1}/${chunks.length})` : '';
          await conn.sendMessage(chatId, { text: chunks[i] + label });
          await new Promise(r => setTimeout(r, 500));
        }
      } else {
        await conn.sendMessage(chatId, { text: reply });
      }

      console.log('[AI] Replied to', senderNum);

    } catch (error) {
      console.log('[AI] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};