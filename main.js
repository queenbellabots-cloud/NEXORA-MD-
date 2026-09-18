/**
 * NEXORA MD - Main Handlers
 * Simple MD-style owner check (paired number = owner)
 * Public/private mode + rate limit
 * Group watchers: anti-link, anti-bad, anti-left
 * Auto-chatbot: Omegatech AI (with session memory + fallback)
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
  if (quoted.viewOnceMessageV2?.message) inner = quoted.viewOnceMessageV2.message;
  else if (quoted.viewOnceMessage?.message) inner = quoted.viewOnceMessage.message;
  else if (quoted.viewOnceMessageV2Extension?.message) inner = quoted.viewOnceMessageV2Extension.message;

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
// SILENT REVEAL
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
    return true;
  } catch (error) {
    logger.error(`Silent reveal error: ${error.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// AUTO CHATBOT (Omegatech AI + fallback)
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

    // Persistent session per sender (for context memory)
    const senderNum = sender.split('@')[0].split(':')[0];
    const sessionId = 'nexora_' + senderNum;

    let reply = null;
    let lastError = null;

    // ─────────────────────────────────────────
    // ATTEMPT 1: Omegatech AI
    // ─────────────────────────────────────────
    try {
      console.log('[AUTOCHATBOT] Trying: Omegatech');

      const res = await axios.post('https://api.omegatech.xyz/ai/chat', {
        message: text,
        sessionId,
        name: pushName
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 45000
      });

      const data = res.data;
      const candidate =
        data?.reply ||
        data?.response ||
        data?.message ||
        data?.result ||
        data?.answer ||
        data?.data ||
        null;

      if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
        // Skip if it's just echoing input
        if (candidate.trim() !== text.trim() || data?.success === true) {
          reply = candidate.trim();
          console.log('[AUTOCHATBOT] Success: Omegatech');
        }
      }
    } catch (e) {
      lastError = e.message;
      console.log('[AUTOCHATBOT] Omegatech failed:', e.message);
    }

    // ─────────────────────────────────────────
    // ATTEMPT 2: Pollinations POST
    // ─────────────────────────────────────────
    if (!reply) {
      try {
        console.log('[AUTOCHATBOT] Trying: pollinations (POST)');

        const res = await axios.post('https://text.pollinations.ai/openai', {
          model: 'openai',
          messages: [
            { role: 'system', content: 'You are NEXORA, a helpful WhatsApp assistant. Reply naturally in the language the user uses.' },
            { role: 'user', content: text }
          ]
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 45000
        });

        const candidate =
          res.data?.choices?.[0]?.message?.content ||
          res.data?.reply ||
          res.data?.response ||
          (typeof res.data === 'string' ? res.data : null);

        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
          reply = candidate.trim();
          console.log('[AUTOCHATBOT] Success: pollinations POST');
        }
      } catch (e) {
        lastError = e.message;
        console.log('[AUTOCHATBOT] Pollinations POST failed:', e.message);
      }
    }

    // ─────────────────────────────────────────
    // ATTEMPT 3: Pollinations GET
    // ─────────────────────────────────────────
    if (!reply) {
      try {
        console.log('[AUTOCHATBOT] Trying: pollinations (GET)');

        const url = `https://text.pollinations.ai/${encodeURIComponent(text)}?model=openai`;
        const res = await axios.get(url, { timeout: 45000 });

        const candidate = typeof res.data === 'string'
          ? res.data
          : (res.data?.reply || res.data?.response);

        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
          reply = candidate.trim();
          console.log('[AUTOCHATBOT] Success: pollinations GET');
        }
      } catch (e) {
        lastError = e.message;
        console.log('[AUTOCHATBOT] Pollinations GET failed:', e.message);
      }
    }

    // ─────────────────────────────────────────
    // ATTEMPT 4: SimSimi
    // ─────────────────────────────────────────
    if (!reply) {
      try {
        console.log('[AUTOCHATBOT] Trying: simsimi');

        const url = `https://api.simsimi.net/v2/?text=${encodeURIComponent(text)}&lc=en`;
        const res = await axios.get(url, { timeout: 20000 });

        const candidate = res.data?.success || res.data?.response || res.data?.msg;

        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0 && candidate !== 'success') {
          reply = candidate.trim();
          console.log('[AUTOCHATBOT] Success: simsimi');
        }
      } catch (e) {
        lastError = e.message;
        console.log('[AUTOCHATBOT] SimSimi failed:', e.message);
      }
    }

    // ─────────────────────────────────────────
    // All failed
    // ─────────────────────────────────────────
    if (!reply) {
      console.log('[AUTOCHATBOT] All endpoints failed. Last error:', lastError);
      try {
        await conn.sendMessage(chatId, {
          text: 'AI service is currently unavailable. Try again later.'
        });
      } catch (e) {}
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

    console.log('[AUTOCHATBOT] Replied to', sender.split('@')[0]);
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

    const prefix = settings.prefix || '.';
    if (!text.startsWith(prefix)) return;

    const afterPrefix = text.slice(prefix.length).trim();
    const parts = afterPrefix.split(' ');
    const rawCommand = parts[0];
    const args = parts.slice(1);

    const sender = mek.key.participant || mek.key.remoteJid;

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