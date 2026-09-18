/**
 * NEXORA MD - Main Handlers
 * Simple MD-style owner check (paired number = owner)
 * Public/private mode + rate limit
 * Group watchers: anti-link, anti-bad, anti-left
 * Auto-chatbot with multi-endpoint AI fallback
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
// AUTO CHATBOT (many endpoints + query param support)
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

    // ═══════════════════════════════════════════════════════
    // ALL KNOWN WORKING ENDPOINTS (David Cyril + fallbacks)
    // ═══════════════════════════════════════════════════════
    const endpoints = [
      // David Cyril current models
      { url: 'https://apis.davidcyril.name.ng/ai/gpt-5', method: 'POST', body: { message: text, name: pushName } },
      { url: 'https://apis.davidcyril.name.ng/ai/gemini3Pro', method: 'POST', body: { message: text, name: pushName } },
      { url: 'https://apis.davidcyril.name.ng/ai/claudeSonnet46', method: 'POST', body: { message: text, name: pushName } },
      { url: 'https://apis.davidcyril.name.ng/ai/chatgpt', method: 'POST', body: { message: text, name: pushName } },
      { url: 'https://apis.davidcyril.name.ng/ai/gemini', method: 'POST', body: { message: text, name: pushName } },
      { url: 'https://apis.davidcyril.name.ng/ai/gpt3', method: 'POST', body: { message: text, name: pushName } },

      // Query param fallbacks (if POST fails, try GET)
      { url: `https://apis.davidcyril.name.ng/ai/gpt-5?q=${encodeURIComponent(text)}`, method: 'GET' },
      { url: `https://apis.davidcyril.name.ng/ai/gemini3Pro?q=${encodeURIComponent(text)}`, method: 'GET' },
      { url: `https://apis.davidcyril.name.ng/ai/chatgpt?q=${encodeURIComponent(text)}`, method: 'GET' },

      // Alternative free APIs
      { url: `https://api.popcat.xyz/chatbot?msg=${encodeURIComponent(text)}`, method: 'GET' },
      { url: `https://api.affiliateplus.xyz/api/chatbot?message=${encodeURIComponent(text)}&botname=NEXORA&ownername=Rodgers`, method: 'GET' },
      { url: `https://api.simsimi.net/v2/?text=${encodeURIComponent(text)}&lc=en`, method: 'GET' }
    ];

    let reply = null;
    let lastError = null;

    for (const ep of endpoints) {
      try {
        let response;
        if (ep.method === 'POST') {
          response = await axios.post(ep.url, ep.body, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
          });
        } else {
          response = await axios.get(ep.url, { timeout: 30000 });
        }

        const data = response.data;
        let candidate =
          data?.reply ||
          data?.response ||
          data?.message ||
          data?.result ||
          data?.answer ||
          data?.data ||
          data?.text ||
          data?.success ||
          data?.msg ||
          (typeof data === 'string' ? data : null);

        // Special handling for simsimi
        if (!candidate && data?.success === 'success') {
          candidate = data?.response;
        }

        // Special handling for popcat
        if (!candidate && data?.chat) {
          candidate = data.chat;
        }

        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
          reply = candidate.trim();
          console.log('[AUTOCHATBOT] Success from:', ep.url.split('?')[0]);
          break;
        } else {
          console.log('[AUTOCHATBOT] No valid reply from:', ep.url.split('?')[0]);
        }
      } catch (err) {
        lastError = err.message;
        console.log('[AUTOCHATBOT] Endpoint failed:', ep.url.split('?')[0], '-', err.message);
      }
    }

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

    if (chatId.endsWith('@g.us')) {
      try {
        const { antiLinkWatcher } = require('./plugins/group/antilink');
        await antiLinkWatcher(conn, mek, chatId);
      } catch (e) {}

      try {
        const { antiBadWatcher } = require('./plugins/group/antibad');
        await antiBadWatcher(conn, mek, chatId);
      } catch (e) {}
    }

    if (!text) return;

    const prefix = settings.prefix || '.';
    if (!text.startsWith(prefix)) return;

    const afterPrefix = text.slice(prefix.length).trim();
    const parts = afterPrefix.split(' ');
    const rawCommand = parts[0];
    const args = parts.slice(1);

    const sender = mek.key.participant || mek.key.remoteJid;

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

    if (global.commands && global.commands.has(commandName)) {
      const command = global.commands.get(commandName);

      if (command.ownerOnly && !isBotOwner) {
        try { await conn.sendMessage(chatId, { react: { text: settings.reactionError, key: mek.key } }); } catch (e) {}
        return;
      }

      if (command.groupOnly && !chatId.endsWith('@g.us')) {
        try { await conn.sendMessage(chatId, { react: { text: settings.reactionError, key: mek.key } }); } catch (e) {}
        return;
      }

      try {
        await command.execute(conn, mek, args, chatId, isBotOwner);
      } catch (error) {
        logger.error(`Error executing ${commandName}: ${error.message}`);
        try { await conn.sendMessage(chatId, { react: { text: settings.reactionError, key: mek.key } }); } catch (e) {}
      }
    } else {
      if (currentMode !== 'private') {
        await conn.sendMessage(chatId, { text: `Unknown command: ${text}\nType ${prefix}menu` });
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