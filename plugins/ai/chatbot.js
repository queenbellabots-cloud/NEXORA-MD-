/**
 * NEXORA MD - Chatbot
 * AI chat with quota-detection + multi-provider fallback
 * Usage:
 *   .chatbot <question>
 *   .chatbot (reply to a message)
 */

const settings = require('../../settings');
const axios = require('axios');

const OMEGATECH_URL = 'https://api.omegatech.xyz/ai/chat';

// ─────────────────────────────────────────────
// PARSE REPLY from both response shapes
// ─────────────────────────────────────────────
function extractReply(data) {
  if (!data) return null;

  if (data.data && typeof data.data === 'object') {
    const nested = data.data.reply || data.data.response || data.data.message;
    if (nested && typeof nested === 'string') return nested;
  }

  const flat = data.reply || data.response || data.message || data.answer;
  if (flat && typeof flat === 'string') return flat;

  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;

  if (typeof data === 'string') return data;

  return null;
}

// ─────────────────────────────────────────────
// DETECT QUOTA / RATE-LIMIT MESSAGES
// ─────────────────────────────────────────────
function isQuotaMessage(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('usage limit') ||
    lower.includes('upgrade to vip') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('limit reached') ||
    lower.includes('please upgrade') ||
    lower.includes('not available right now')
  );
}

// ─────────────────────────────────────────────
// PROVIDERS (in order)
// ─────────────────────────────────────────────

// 1. Omegatech
async function tryOmegatech(question, sessionId, pushName) {
  const res = await axios.post(OMEGATECH_URL, {
    message: question,
    sessionId,
    name: pushName
  }, {
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 45000
  });

  const reply = extractReply(res.data);

  if (!reply) return { ok: false, reason: 'empty' };
  if (isQuotaMessage(reply)) return { ok: false, reason: 'quota', reply };

  return { ok: true, reply: reply.trim() };
}

// 2. Pollinations (POST)
async function tryPollinationsPost(question) {
  const res = await axios.post('https://text.pollinations.ai/openai', {
    model: 'openai',
    messages: [
      { role: 'system', content: 'You are NEXORA, a helpful WhatsApp AI assistant.' },
      { role: 'user', content: question }
    ]
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 45000
  });

  const reply = extractReply(res.data);
  if (!reply || isQuotaMessage(reply)) return { ok: false };
  return { ok: true, reply: reply.trim() };
}

// 3. Pollinations (GET)
async function tryPollinationsGet(question) {
  const url = `https://text.pollinations.ai/${encodeURIComponent(question)}?model=openai`;
  const res = await axios.get(url, { timeout: 45000 });

  const reply = typeof res.data === 'string' ? res.data : extractReply(res.data);
  if (!reply || isQuotaMessage(reply)) return { ok: false };
  return { ok: true, reply: reply.trim() };
}

// 4. SimSimi
async function trySimSimi(question) {
  const url = `https://api.simsimi.net/v2/?text=${encodeURIComponent(question)}&lc=en`;
  const res = await axios.get(url, { timeout: 20000 });

  const reply = res.data?.success || res.data?.response || res.data?.msg;
  if (!reply || reply === 'success' || isQuotaMessage(reply)) return { ok: false };
  return { ok: true, reply: reply.trim() };
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'chatbot',
  aliases: ['bot', 'nexora'],
  category: 'ai',
  description: 'Chat with the AI chatbot',
  usage: '.chatbot <question>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      // 1. Get question
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
            `Chatbot\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}chatbot <question>\n` +
            `  Reply to a message with ${settings.prefix || '.'}chatbot\n\n` +
            `Examples:\n` +
            `  ${settings.prefix || '.'}chatbot Hi, how are you?\n` +
            `  ${settings.prefix || '.'}chatbot Tell me a joke\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // 2. React and notify
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Thinking...` });

      // 3. Session ID
      const sender = mek.key.participant || mek.key.remoteJid;
      const senderNum = sender.split('@')[0].split(':')[0];
      const sessionId = 'chatbot_' + senderNum;
      const pushName = mek.pushName || 'User';

      // 4. Try providers in order
      let reply = null;
      let lastError = null;
      let omegatechQuotaHit = false;

      // Omegatech
      try {
        console.log('[CHATBOT] Trying Omegatech');
        const r = await tryOmegatech(question, sessionId, pushName);

        if (r.ok) {
          reply = r.reply;
          console.log('[CHATBOT] Success: Omegatech');
        } else {
          if (r.reason === 'quota') {
            omegatechQuotaHit = true;
            console.log('[CHATBOT] Omegatech quota exceeded — falling back');
          } else {
            console.log('[CHATBOT] Omegatech returned empty');
          }
        }
      } catch (e) {
        lastError = e.message;
        console.log('[CHATBOT] Omegatech failed:', e.message);
      }

      // Pollinations POST
      if (!reply) {
        try {
          console.log('[CHATBOT] Trying Pollinations POST');
          const r = await tryPollinationsPost(question);
          if (r.ok) {
            reply = r.reply;
            console.log('[CHATBOT] Success: Pollinations POST');
          }
        } catch (e) {
          lastError = e.message;
          console.log('[CHATBOT] Pollinations POST failed:', e.message);
        }
      }

      // Pollinations GET
      if (!reply) {
        try {
          console.log('[CHATBOT] Trying Pollinations GET');
          const r = await tryPollinationsGet(question);
          if (r.ok) {
            reply = r.reply;
            console.log('[CHATBOT] Success: Pollinations GET');
          }
        } catch (e) {
          lastError = e.message;
          console.log('[CHATBOT] Pollinations GET failed:', e.message);
        }
      }

      // SimSimi
      if (!reply) {
        try {
          console.log('[CHATBOT] Trying SimSimi');
          const r = await trySimSimi(question);
          if (r.ok) {
            reply = r.reply;
            console.log('[CHATBOT] Success: SimSimi');
          }
        } catch (e) {
          lastError = e.message;
          console.log('[CHATBOT] SimSimi failed:', e.message);
        }
      }

      // 5. Send
      if (!reply) {
        console.log('[CHATBOT] All providers failed. Last error:', lastError);
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `AI is currently unavailable. Try again later.` +
            (omegatechQuotaHit ? `\n\n(Daily quota reached on primary provider)` : '') +
            `\n\n${settings.footer}`
        });
        return;
      }

      reply = reply.replace(/\*\*/g, '*').trim();

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

      console.log('[CHATBOT] Replied to', senderNum);

    } catch (error) {
      console.log('[CHATBOT] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};