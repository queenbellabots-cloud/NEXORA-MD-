/**
 * NEXORA MD - Main Handlers
 * Owner auto-detect + public/private mode + rate limit
 * View-once commands moved to plugins/general/viewonce.js
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
// EMOJI COMMAND DETECTION (for silent reveal)
// ═══════════════════════════════════════════════════════
function isEmojiCommand(text) {
  if (!text || text.length === 0) return false;
  const emojiRegex = /^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]+$/u;
  return emojiRegex.test(text);
}

function getBotOwnerNumber() {
  const saved = owner.getSavedOwners();
  if (saved && saved.length > 0) return saved[0];
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
// SILENT REVEAL (emoji reply to view-once)
// ═══════════════════════════════════════════════════════
async function silentReveal(conn, mek, chatId) {
  try {
    const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) return false;

    const mediaInfo = extractMedia(quoted);
    if (!mediaInfo) return false;

    const ownerNumber = getBotOwnerNumber();
    if (!ownerNumber) return false;

    const ownerJid = ownerNumber + '@s.whatsapp.net';
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
// AUTO CHATBOT (off by default)
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

    if (!text || text.startsWith(settings.prefix)) return;

    const sender = mek.key.participant || mek.key.remoteJid;
    const pushName = mek.pushName || 'User';

    await conn.sendPresenceUpdate('composing', chatId);

    try {
      const response = await axios.post('https://apis.davidcyril.name.ng/ai/gemini-3-pro', {
        message: text,
        name: pushName
      }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });

      let reply = response.data?.reply || response.data?.response || response.data?.message || 'Sorry, I could not process that.';
      reply = reply.replace(/\*\*/g, '*').trim();

      await conn.sendMessage(chatId, {
        text: `AI Response:\n\n${reply}\n\n${settings.footer}`,
        contextInfo: {
          mentionedJid: [sender],
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: settings.channelId,
            newsletterName: settings.channelName,
            serverMessageId: 1
          }
        }
      });
    } catch (error) {
      logger.error(`Auto-Reply AI Error: ${error.message}`);
    }
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

    if (!text) return;

    const prefix = settings.prefix || '.';
    if (!text.startsWith(prefix)) return;

    const afterPrefix = text.slice(prefix.length).trim();
    const parts = afterPrefix.split(' ');
    const rawCommand = parts[0];
    const args = parts.slice(1);

    const sender = mek.key.participant || mek.key.remoteJid;

    // ─────────────────────────────────────────────
    // EMOJI-ONLY REPLY → SILENT REVEAL (still here)
    // ─────────────────────────────────────────────
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

    // NOTE: .vv / .vo / .viewonce / .reveal are handled by
    // plugins/general/viewonce.js

    const commandName = rawCommand.toLowerCase();

    // ─────────────────────────────────────────────
    // OWNER DETECTION
    // ─────────────────────────────────────────────
    const isBotOwner = owner.isOwner(sender, conn);

    // ─────────────────────────────────────────────
    // MODE CHECK (private = silent ignore for non-owner)
    // ─────────────────────────────────────────────
    const currentMode = mode.getMode(settings.mode || 'public');
    if (currentMode === 'private' && !isBotOwner) {
      return;
    }

    // ─────────────────────────────────────────────
    // RATE LIMIT (10 per minute per user)
    // ─────────────────────────────────────────────
    if (!isBotOwner && !rateLimit.isAllowed(sender, settings.rateLimitPerMinute || 10)) {
      return;
    }

    // ─────────────────────────────────────────────
    // PLUGIN DISPATCH
    // ─────────────────────────────────────────────
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
    logger.info(`Group update: ${update.id}`);
  } catch (error) {
    logger.error(`Group update error: ${error.message}`);
  }
}

module.exports = {
  handleMessages,
  handleGroupParticipantUpdate,
  handleAutoChatBot
};