/**
 * NEXORA MD - Main Handlers
 * Simple MD-style owner check (paired number = owner)
 * Public/private mode + rate limit
 * Group watchers: anti-link, anti-bad, anti-left
 * Auto-chatbot: 9 keyless providers (no API keys needed)
 * Silent view-once reveal: owner replies with .<emoji>
 */

const settings = require('./settings');
const axios = require('axios');
const fs = require('fs');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const mode = require('./lib/mode');
const rateLimit = require('./lib/rateLimit');
const owner = require('./lib/owner');
const logger = require('./lib/logger');

const cleanNumber = owner.cleanNumber;

// ═══════════════════════════════════════════════════════
// EMOJI COMMAND DETECTION
// ═══════════════════════════════════════════════════════
function isEmojiCommand(text) {
  if (!text || text.length === 0) return false;
  const emojiRegex = /^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]+$/u;
  return emojiRegex.test(text);
}

function getBotOwnerNumber() {
  const paired = owner.getPairedNumber ? owner.getPairedNumber() : '';
  if (paired) return paired;
  return settings.ownerNumber || null;
}

// ═══════════════════════════════════════════════════════
// MEDIA EXTRACTION
// ═══════════════════════════════════════════════════════
function extractMedia(quoted) {
  if (!quoted) return null;

  let inner = quoted;
  for (let i = 0; i < 4; i++) {
    const wrapper =
      inner.viewOnceMessageV2?.message ||
      inner.viewOnceMessage?.message ||
      inner.viewOnceMessageV2Extension?.message ||
      inner.documentWithCaptionMessage?.message ||
      inner.ephemeralMessage?.message;
    if (wrapper) inner = wrapper;
    else break;
  }

  if (inner.imageMessage) return { type: 'image', media: inner.imageMessage, caption: inner.imageMessage.caption || '' };
  if (inner.videoMessage) return { type: 'video', media: inner.videoMessage, caption: inner.videoMessage.caption || '' };
  if (inner.audioMessage) return { type: 'audio', media: inner.audioMessage, caption: inner.audioMessage.caption || '' };
  return null;
}

async function downloadMedia(mediaInfo) {
  try {
    const stream = await downloadContentFromMessage(mediaInfo.media, mediaInfo.type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  } catch (error) {
    logger.error(`Download failed: ${error.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// SILENT REVEAL — internal fallback
// ═══════════════════════════════════════════════════════
async function silentReveal(conn, mek, chatId) {
  try {
    const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return false;

    const mediaInfo = extractMedia(quoted);
    if (!mediaInfo) return false;

    const ownerNumber = getBotOwnerNumber();
    if (!ownerNumber) return false;

    const ownerJid = ownerNumber.includes('@') ? ownerNumber : ownerNumber + '@s.whatsapp.net';
    const buffer = await downloadMedia(mediaInfo);
    if (!buffer || buffer.length === 0) return false;

    const sender = mek.key.participant || mek.key.remoteJid;
    const senderNumber = cleanNumber(sender);

    const caption = `SILENT REVEAL

From: ${senderNumber}
Chat: ${chatId.split('@')[0]}
Time: ${new Date().toLocaleString()}

${mediaInfo.caption ? `Caption:\n${mediaInfo.caption}` : ''}

${settings.footer}`;

    const content = { caption };
    if (mediaInfo.type === 'image') content.image = buffer;
    else if (mediaInfo.type === 'video') content.video = buffer;
    else if (mediaInfo.type === 'audio') { content.audio = buffer; content.ptt = true; }

    await conn.sendMessage(ownerJid, content);
    console.log('[MAIN-SILENTVV] Revealed to owner (fallback):', senderNumber);
    return true;
  } catch (error) {
    logger.error(`Silent reveal error: ${error.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// AUTO CHATBOT — 9 keyless providers
// ═══════════════════════════════════════════════════════
async function handleAutoChatBot(conn, mek) {
  try {
    if (!global.autoChatBot) return;

    const chatId = mek.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const isStatus = chatId === 'status@broadcast';
    const isChannel = chatId.includes('@newsletter');

    if (isGroup || isStatus || isChannel) return;
    if (mek.key.fromMe) return;

    let text = '';
    if (mek.message.conversation) text = mek.message.conversation;
    else if (mek.message.extendedTextMessage) text = mek.message.extendedTextMessage.text;
    else return;

    if (!text) return;
    if (text.startsWith(settings.prefix || '.')) return;
    if (/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]+$/u.test(text.trim())) return;

    const sender = mek.key.participant || mek.key.remoteJid;
    const pushName = mek.pushName || 'User';

    try {
      await conn.sendPresenceUpdate('composing', chatId);
    } catch (e) {}

    const senderNum = sender.split('@')[0].split(':')[0];

    let reply = null;
    let lastError = null;
    let usedProvider = '';

    // ─── 1: GPT-5.5 ───
    if (!reply) {
      try {
        console.log('[AUTOCHATBOT] 1/9 GPT-5.5');

        const res = await axios.post('https://apis.davidcyril.name.ng/ai/gpt-5.5', {
          message: text, name: pushName
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 45000
        });

        const candidate =
          res.data?.reply ||
          res.data?.response ||
          res.data?.message ||
          res.data?.result ||
          res.data?.data?.reply ||
          (typeof res.data === 'string' ? res.data : null);

        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
          reply = candidate.trim();
          usedProvider = 'GPT-5.5';
          console.log('[AUTOCHATBOT] ✅ GPT-5.5');
        }
      } catch (e) {
        lastError = e.message;
        console.log('[AUTOCHATBOT] ❌ GPT-5.5:', e.message);
      }
    }

    // ─── 2: DeepSeek ───
    if (!reply) {
      try {
        console.log('[AUTOCHATBOT] 2/9 DeepSeek');

        const res = await axios.post('https://apis.davidcyril.name.ng/ai/deepseek-v3.2-thinking', {
          message: text, name: pushName
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 45000
        });

        const candidate =
          res.data?.reply ||
          res.data?.response ||
          res.data?.message ||
          res.data?.result ||
          res.data?.data?.reply ||
          res.data?.thinking ||
          (typeof res.data === 'string' ? res.data : null);

        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
          reply = candidate.trim();
          usedProvider = 'DeepSeek';
          console.log('[AUTOCHATBOT] ✅ DeepSeek');
        }
      } catch (e) {
        lastError = e.message;
        console.log('[AUTOCHATBOT] ❌ DeepSeek:', e.message);
      }
    }

    // ─── 3: Blackbox ───
    if (!reply) {
      try {
        console.log('[AUTOCHATBOT] 3/9 Blackbox');

        const res = await axios.post('https://apis.davidcyril.name.ng/blackbox', {
          message: text, name: pushName
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 45000
        });

        const candidate =
          res.data?.reply ||
          res.data?.response ||
          res.data?.message ||
          res.data?.result ||
          res.data?.data?.reply ||
          (typeof res.data === 'string' ? res.data : null);

        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
          reply = candidate.trim();
          usedProvider = 'Blackbox';
          console.log('[AUTOCHATBOT] ✅ Blackbox');
        }
      } catch (e) {
        lastError = e.message;
        console.log('[AUTOCHATBOT] ❌ Blackbox:', e.message);
      }
    }

    // ─── 4: Kilo Gateway ───
    if (!reply) {
      try {
        console.log('[AUTOCHATBOT] 4/9 Kilo Gateway');

        const res = await axios.post('https://api.kilo.ai/api/gateway/chat/completions', {
          model: 'kilo-auto/free',
          messages: [
            { role: 'system', content: 'You are NEXORA, a helpful WhatsApp assistant. Reply naturally in the user\'s language.' },
            { role: 'user', content: text }
          ]
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        });

        const candidate = res.data?.choices?.[0]?.message?.content;

        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
          reply = candidate.trim();
          usedProvider = 'Kilo';
          console.log('[AUTOCHATBOT] ✅ Kilo');
        }
      } catch (e) {
        lastError = e.message;
        console.log('[AUTOCHATBOT] ❌ Kilo:', e.message);
      }
    }

    // ─── 5: KeylessAI (Thryx) ───
    if (!reply) {
      try {
        console.log('[AUTOCHATBOT] 5/9 KeylessAI');

        const res = await axios.post('https://keylessai.thryx.workers.dev/v1/chat/completions', {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: text }]
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        });

        const candidate = res.data?.choices?.[0]?.message?.content;

        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
          reply = candidate.trim();
          usedProvider = 'KeylessAI';
          console.log('[AUTOCHATBOT] ✅ KeylessAI');
        }
      } catch (e) {
        lastError = e.message;
        console.log('[AUTOCHATBOT] ❌ KeylessAI:', e.message);
      }
    }

    // ─── 6: GPT-AI v1 ───
    if (!reply) {
      try {
        console.log('[AUTOCHATBOT] 6/9 GPT-AI v1');

        const res = await axios.post('https://gpt-ai-olive.vercel.app/chat/v1', {
          userMessage: text
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        });

        const candidate = res.data?.reply || res.data?.response || res.data?.message;

        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
          reply = candidate.trim();
          usedProvider = 'GPT-AI v1';
          console.log('[AUTOCHATBOT] ✅ GPT-AI v1');
        }
      } catch (e) {
        lastError = e.message;
        console.log('[AUTOCHATBOT] ❌ GPT-AI v1:', e.message);
      }
    }

    // ─── 7: GPT-AI v2 ───
    if (!reply) {
      try {
        console.log('[AUTOCHATBOT] 7/9 GPT-AI v2');

        const res = await axios.post('https://gpt-ai-olive.vercel.app/chat/v2', {
          userMessage: text
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        });

        const candidate = res.data?.reply || res.data?.response || res.data?.message;

        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
          reply = candidate.trim();
          usedProvider = 'GPT-AI v2';
          console.log('[AUTOCHATBOT] ✅ GPT-AI v2');
        }
      } catch (e) {
        lastError = e.message;
        console.log('[AUTOCHATBOT] ❌ GPT-AI v2:', e.message);
      }
    }

    // ─── 8: Omegatech ───
    if (!reply) {
      try {
        console.log('[AUTOCHATBOT] 8/9 Omegatech');

        const res = await axios.post('https://api.omegatech.xyz/ai/chat', {
          message: text, sessionId: 'nexora_' + senderNum, name: pushName
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        });

        const candidate = res.data?.data?.reply || res.data?.reply || res.data?.response;

        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
          reply = candidate.trim();
          usedProvider = 'Omegatech';
          console.log('[AUTOCHATBOT] ✅ Omegatech');
        }
      } catch (e) {
        lastError = e.message;
        console.log('[AUTOCHATBOT] ❌ Omegatech:', e.message);
      }
    }

    // ─── 9: SimSimi ───
    if (!reply) {
      try {
        console.log('[AUTOCHATBOT] 9/9 SimSimi');

        const res = await axios.get(`https://api.simsimi.net/v2/?text=${encodeURIComponent(text)}&lc=en`, {
          timeout: 15000
        });

        const candidate = res.data?.success || res.data?.response || res.data?.msg;

        if (candidate && candidate !== 'success' && candidate.trim().length > 0) {
          reply = candidate.trim();
          usedProvider = 'SimSimi';
          console.log('[AUTOCHATBOT] ✅ SimSimi');
        }
      } catch (e) {
        lastError = e.message;
        console.log('[AUTOCHATBOT] ❌ SimSimi:', e.message);
      }
    }

    // ─── All failed ───
    if (!reply) {
      console.log('[AUTOCHATBOT] All providers failed. Last:', lastError);
      try {
        await conn.sendMessage(chatId, {
          text: 'AI service is currently unavailable. Try again later.',
          chatbot_exempt: true
        });
      } catch (e) {}
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
        await conn.sendMessage(chatId, {
          text: chunks[i] + label,
          chatbot_exempt: true
        });
        await new Promise(r => setTimeout(r, 500));
      }
    } else {
      await conn.sendMessage(chatId, {
        text: reply,
        chatbot_exempt: true
      });
    }

    console.log(`[AUTOCHATBOT] Replied to ${senderNum} via ${usedProvider}`);
  } catch (error) {
    logger.error(`Auto-ChatBot Error: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════
// MAIN MESSAGE HANDLER
// ═══════════════════════════════════════════════════════
async function handleMessages(conn, chatUpdate, isOwnerFlag) {
  try {
    const mek = chatUpdate.messages[0];
    if (!mek || !mek.message) return;

    const chatId = mek.key.remoteJid;
    const isStatus = chatId === 'status@broadcast';
    const isChannel = chatId.includes('@newsletter');

    if (isStatus || isChannel) return;

    let text = '';
    if (mek.message.conversation) text = mek.message.conversation;
    else if (mek.message.extendedTextMessage) text = mek.message.extendedTextMessage.text;
    else if (mek.message.imageMessage) text = mek.message.imageMessage.caption || '';
    else if (mek.message.videoMessage) text = mek.message.videoMessage.caption || '';

    const prefix = settings.prefix || '.';
    const sender = mek.key.participant || mek.key.remoteJid;

    // ═════════════════════════════════════════
    // PRIORITY 1 — SILENT VIEW-ONCE REVEAL (.emoji)
    // ═════════════════════════════════════════
    if (text && text.startsWith(prefix) && text.length > prefix.length) {
      const afterPrefixCheck = text.slice(prefix.length).trim();

      if (isEmojiCommand(afterPrefixCheck)) {
        console.log('[SILENTVV] Emoji-prefixed reply detected');

        const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted) {
          console.log('[SILENTVV] No quoted message');
          return;
        }

        const mediaInfo = extractMedia(quoted);

        if (!mediaInfo) {
          console.log('[SILENTVV] No view-once media');
          return;
        }

        const isBotOwnerCheck = owner.isOwner(sender, conn);
        if (!isBotOwnerCheck) {
          console.log('[SILENTVV] Not owner — skipping');
          return;
        }

        console.log('[SILENTVV] Revealing', mediaInfo.type);

        let revealed = false;
        try {
          const silentvvPlugin = require('./plugins/owner/silentvv');
          if (silentvvPlugin && typeof silentvvPlugin.silentRevealToOwner === 'function') {
            revealed = await silentvvPlugin.silentRevealToOwner(conn, mek, chatId, mediaInfo);
          }
        } catch (e) {
          console.log('[SILENTVV] Plugin failed:', e.message);
          revealed = false;
        }

        if (!revealed) {
          console.log('[SILENTVV] Using internal fallback');
          await silentReveal(conn, mek, chatId);
        }

        return;
      }
    }

    // Auto-chatbot runs next
    try { await handleAutoChatBot(conn, mek); } catch (e) {}

    // ─────────────────────────────────────────
    // GROUP WATCHERS
    // ─────────────────────────────────────────
    if (chatId.endsWith('@g.us')) {
      try {
        const { antiLinkWatcher } = require('./plugins/group/antilink');
        await antiLinkWatcher(conn, mek, chatId);
      } catch (e) {
        console.log('[ANTILINK] Hook error:', e.message);
      }

      try {
        const { antiBadWatcher } = require('./plugins/group/antibad');
        await antiBadWatcher(conn, mek, chatId);
      } catch (e) {
        console.log('[ANTIBAD] Hook error:', e.message);
      }
    }

    if (!text) return;
    if (!text.startsWith(prefix)) return;

    const afterPrefix = text.slice(prefix.length).trim();
    const parts = afterPrefix.split(' ');
    const rawCommand = parts[0];
    const args = parts.slice(1);

    // ─────────────────────────────────────────
    // EMOJI-ONLY REPLY → SILENT REVEAL
    // ─────────────────────────────────────────
    if (isEmojiCommand(rawCommand)) {
      const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted) {
        const mediaInfo = extractMedia(quoted);
        if (mediaInfo) {
          await silentReveal(conn, mek, chatId);
          return;
        }
      }
      return;
    }

    const commandName = rawCommand.toLowerCase();

    const isBotOwner = owner.isOwner(sender, conn);

    const currentMode = mode.getMode(settings.mode || 'public');
    if (currentMode === 'private' && !isBotOwner) return;

    if (!isBotOwner && !rateLimit.isAllowed(sender, settings.rateLimitPerMinute || 10)) return;

    // ─────────────────────────────────────────
    // PLUGIN DISPATCH
    // ─────────────────────────────────────────
    if (global.commands && global.commands.has(commandName)) {
      const command = global.commands.get(commandName);

      if (command.ownerOnly && !isBotOwner) {
        try {
          await conn.sendMessage(chatId, { react: { text: settings.reactionError, key: mek.key } });
        } catch (e) {}
        return;
      }

      if (command.groupOnly && !chatId.endsWith('@g.us')) {
        try {
          await conn.sendMessage(chatId, { react: { text: settings.reactionError, key: mek.key } });
        } catch (e) {}
        return;
      }

      try {
        await command.execute(conn, mek, args, chatId, isBotOwner);
      } catch (error) {
        logger.error(`Error executing ${commandName}: ${error.message}`);
        try {
          await conn.sendMessage(chatId, { react: { text: settings.reactionError, key: mek.key } });
        } catch (e) {}
      }
    } else {
      if (currentMode !== 'private') {
        await conn.sendMessage(chatId, {
          text: `Unknown command: ${text}\nType ${prefix}menu`
        });
      }
    }
  } catch (error) {
    logger.error(`Error in handleMessages: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════
// GROUP PARTICIPANT UPDATE
// ═══════════════════════════════════════════════════════
async function handleGroupParticipantUpdate(conn, update) {
  try {
    logger.info(`Group update: ${update.id} (${update.action})`);

    try {
      const { antiLeftWatcher } = require('./plugins/group/antileft');
      await antiLeftWatcher(conn, update);
    } catch (e) {
      console.log('[ANTILEFT] Hook error:', e.message);
    }
  } catch (error) {
    logger.error(`Group update error: ${error.message}`);
  }
}

module.exports = {
  handleMessages,
  handleGroupParticipantUpdate,
  handleAutoChatBot
};