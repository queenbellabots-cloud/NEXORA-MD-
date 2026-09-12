/**
 * NEXORA MD - .ff - Forward view-once media to a number
 * Usage: .ff 2547XXXXXXXX  (reply to a view-once image/video/audio)
 * Special: .ff owner  |  .ff me
 */

const settings = require('../../settings');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ownerLib = require('../../lib/owner');

const FF_REACTIONS = ['📤', '➡️', '🎯', '📨', '✅'];

function extractViewOnce(quoted) {
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
  const stream = await downloadContentFromMessage(mediaInfo.media, mediaInfo.type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function cleanNumber(s) {
  return String(s || '').replace(/[^0-9]/g, '');
}

function isValidNumber(num) {
  return /^[0-9]{8,15}$/.test(num);
}

module.exports = {
  name: 'ff',
  aliases: ['forward', 'fwd'],
  category: 'general',
  description: 'Forward a view-once message to a number',
  usage: '.ff 2547XXXXXXXX  (reply to a view-once)',
  ownerOnly: false,
  react: '📤',

  async execute(conn, mek, args, chatId, isOwner) {
    const usageText =
      `Forward a view-once message\n\n` +
      `Usage:\n` +
      `  ${settings.prefix || '.'}ff 2547XXXXXXXX   - forward to a number\n` +
      `  ${settings.prefix || '.'}ff owner           - forward to bot owner\n` +
      `  ${settings.prefix || '.'}ff me              - forward to yourself\n\n` +
      `Reply to a view-once message with the command.\n\n` +
      `${settings.footer}`;

    try {
      // ─────────────────────────────────────────
      // 1. Must have an argument
      // ─────────────────────────────────────────
      const target = (args[0] || '').trim();
      if (!target) {
        try {
          await conn.sendMessage(chatId, { react: { text: settings.reactionError, key: mek.key } });
        } catch (e) {}
        await conn.sendMessage(chatId, { text: usageText });
        return;
      }

      // ─────────────────────────────────────────
      // 2. Must be replying to a message
      // ─────────────────────────────────────────
      const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted) {
        try {
          await conn.sendMessage(chatId, { react: { text: settings.reactionError, key: mek.key } });
        } catch (e) {}
        await conn.sendMessage(chatId, {
          text: `Reply to a view-once message with ${settings.prefix || '.'}ff <number>\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 3. Extract view-once media
      // ─────────────────────────────────────────
      const mediaInfo = extractViewOnce(quoted);
      if (!mediaInfo) {
        try {
          await conn.sendMessage(chatId, { react: { text: settings.reactionError, key: mek.key } });
        } catch (e) {}
        await conn.sendMessage(chatId, {
          text: `No view-once media found in the replied message.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 4. Resolve target number
      // ─────────────────────────────────────────
      const sender = mek.key.participant || mek.key.remoteJid;
      const senderNumber = cleanNumber(sender);

      let targetNumber = '';

      const lowerTarget = target.toLowerCase();

      if (lowerTarget === 'owner') {
        const owners = ownerLib.getOwnerNumbers(conn);
        targetNumber = owners[0] || cleanNumber(settings.ownerNumber);
      } else if (lowerTarget === 'me') {
        targetNumber = senderNumber;
      } else {
        targetNumber = cleanNumber(target);
      }

      if (!isValidNumber(targetNumber)) {
        try {
          await conn.sendMessage(chatId, { react: { text: settings.reactionError, key: mek.key } });
        } catch (e) {}
        await conn.sendMessage(chatId, {
          text:
            `Invalid number: ${target}\n` +
            `Use digits only with country code, no + or spaces.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const targetJid = targetNumber + '@s.whatsapp.net';

      // ─────────────────────────────────────────
      // 5. Download media
      // ─────────────────────────────────────────
      let buffer = null;
      try {
        buffer = await downloadMedia(mediaInfo);
      } catch (dlErr) {
        console.log('[FF] Download error:', dlErr.message);
      }

      if (!buffer || buffer.length === 0) {
        try {
          await conn.sendMessage(chatId, { react: { text: settings.reactionError, key: mek.key } });
        } catch (e) {}
        await conn.sendMessage(chatId, {
          text: `Download failed. Try again.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 6. Build caption + content
      // ─────────────────────────────────────────
      const caption =
        `FORWARDED VIEW-ONCE\n\n` +
        `From: ${senderNumber}\n` +
        `Chat: ${chatId.split('@')[0]}\n` +
        `Time: ${new Date().toLocaleString()}\n\n` +
        `${mediaInfo.caption ? 'Caption:\n' + mediaInfo.caption + '\n\n' : ''}` +
        `${settings.footer}`;

      const content = { caption };
      if (mediaInfo.type === 'image') content.image = buffer;
      else if (mediaInfo.type === 'video') content.video = buffer;
      else if (mediaInfo.type === 'audio') { content.audio = buffer; content.ptt = true; }

      // ─────────────────────────────────────────
      // 7. Send to target
      // ─────────────────────────────────────────
      let sent = false;
      try {
        await conn.sendMessage(targetJid, content);
        sent = true;
      } catch (sendErr) {
        console.log('[FF] Send error:', sendErr.message);
      }

      // ─────────────────────────────────────────
      // 8. React + confirm in current chat
      // ─────────────────────────────────────────
      if (sent) {
        try {
          const emoji = FF_REACTIONS[Math.floor(Math.random() * FF_REACTIONS.length)];
          await conn.sendMessage(chatId, { react: { text: emoji, key: mek.key } });
        } catch (e) {}

        // If forward target is not the current chat, confirm in chat
        const cleanChat = chatId.split('@')[0].split(':')[0];
        if (cleanChat !== targetNumber) {
          await conn.sendMessage(chatId, {
            text: `Forwarded to ${targetNumber}\n\n${settings.footer}`
          });
        }
      } else {
        try {
          await conn.sendMessage(chatId, { react: { text: settings.reactionError, key: mek.key } });
        } catch (e) {}
        await conn.sendMessage(chatId, {
          text: `Failed to forward. Check the number and try again.\n\n${settings.footer}`
        });
      }

    } catch (error) {
      console.log('[FF] Error:', error.message);
      try {
        await conn.sendMessage(chatId, { react: { text: settings.reactionError, key: mek.key } });
      } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};