/**
 * NEXORA MD - GPT
 * AI chat using Omegatech's ChatGPT model
 * Supports both flat and nested response shapes
 * Usage:
 *   .gpt <question>
 *   .gpt (reply to a message)
 */

const settings = require('../../settings');
const axios = require('axios');

const API_URL = 'https://api.omegatech.xyz/ai/chat';

// ─────────────────────────────────────────────
// PARSE REPLY (both response shapes)
// ─────────────────────────────────────────────
function extractReply(data) {
  if (!data) return null;

  // Nested shape: { data: { reply: "..." } }
  if (data.data && typeof data.data === 'object') {
    const nested =
      data.data.reply ||
      data.data.response ||
      data.data.message ||
      data.data.answer;
    if (nested && typeof nested === 'string') return nested;
  }

  // Flat shape: { reply: "..." }
  const flat =
    data.reply ||
    data.response ||
    data.message ||
    data.answer ||
    data.result;
  if (flat && typeof flat === 'string') return flat;

  // OpenAI style
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }

  // Raw string
  if (typeof data === 'string') return data;

  return null;
}

module.exports = {
  name: 'gpt',
  aliases: ['chatgpt', 'openai'],
  category: 'ai',
  description: 'Chat with GPT (ChatGPT model)',
  usage: '.gpt <question>',
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
            `GPT (ChatGPT)\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}gpt <question>\n` +
            `  Reply to a message with ${settings.prefix || '.'}gpt\n\n` +
            `Examples:\n` +
            `  ${settings.prefix || '.'}gpt Explain quantum physics\n` +
            `  ${settings.prefix || '.'}gpt Write a poem about rain\n\n` +
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
      // 3. Build session ID
      // ─────────────────────────────────────────
      const sender = mek.key.participant || mek.key.remoteJid;
      const senderNum = sender.split('@')[0].split(':')[0];
      const sessionId = 'gpt_' + senderNum;
      const pushName = mek.pushName || 'User';

      // ─────────────────────────────────────────
      // 4. Call API
      // ─────────────────────────────────────────
      let reply = null;
      let lastError = null;

      // ─── Attempt 1: Primary endpoint POST ───
      try {
        console.log('[GPT] Trying:', API_URL);

        const res = await axios.post(API_URL, {
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

        const candidate = extractReply(res.data);

        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
          if (candidate.trim() !== question.trim()) {
            reply = candidate.trim();
            console.log('[GPT] Success: primary');
          } else if (res.data?.success === true) {
            reply = candidate.trim();
            console.log('[GPT] Success: primary (echo accepted)');
          }
        }
      } catch (e) {
        lastError = e.message;
        console.log('[GPT] Primary failed:', e.message);
      }

      // ─── Attempt 2: GET fallback ───
      if (!reply) {
        try {
          console.log('[GPT] Trying: GET fallback');

          const res = await axios.get(API_URL, {
            params: { message: question, sessionId, name: pushName },
            timeout: 45000
          });

          const candidate = extractReply(res.data);

          if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
            reply = candidate.trim();
            console.log('[GPT] Success: GET');
          }
        } catch (e) {
          lastError = e.message;
          console.log('[GPT] GET failed:', e.message);
        }
      }

      // ─── Attempt 3: Alternate paths ───
      if (!reply) {
        const altPaths = ['/ai/chatgpt', '/ai/gpt', '/ai'];

        for (const p of altPaths) {
          try {
            console.log('[GPT] Trying:', p);

            const res = await axios.post(`https://api.omegatech.xyz${p}`, {
              message: question,
              sessionId,
              name: pushName
            }, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 45000
            });

            const candidate = extractReply(res.data);

            if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
              reply = candidate.trim();
              console.log('[GPT] Success:', p);
              break;
            }
          } catch (e) {
            console.log('[GPT]', p, 'failed:', e.message);
          }
        }
      }

      // ─── Attempt 4: Pollinations fallback ───
      if (!reply) {
        try {
          console.log('[GPT] Fallback: pollinations');

          const res = await axios.post('https://text.pollinations.ai/openai', {
            model: 'openai',
            messages: [
              { role: 'system', content: 'You are NEXORA, a helpful WhatsApp AI assistant powered by GPT.' },
              { role: 'user', content: question }
            ]
          }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 45000
          });

          const candidate = extractReply(res.data);

          if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
            reply = candidate.trim();
            console.log('[GPT] Success: pollinations');
          }
        } catch (e) {
          lastError = e.message;
          console.log('[GPT] Pollinations failed:', e.message);
        }
      }

      // ─────────────────────────────────────────
      // 5. Send reply
      // ─────────────────────────────────────────
      if (!reply) {
        console.log('[GPT] All endpoints failed. Last error:', lastError);
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `GPT is currently unavailable. Try again later.\n\n${settings.footer}`
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

      console.log('[GPT] Replied to', senderNum);

    } catch (error) {
      console.log('[GPT] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};