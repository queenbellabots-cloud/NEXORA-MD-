/**
 * NEXORA MD - Save Replied Status
 * Saves the replied status media into the current chat (DM with the poster)
 * Usage: reply to a status with .ss (or .save)
 */

const settings = require('../../settings');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// ─────────────────────────────────────────────
// DEEP MEDIA EXTRACTION (unwraps all known wrappers)
// ─────────────────────────────────────────────
function extractMediaFromQuoted(quoted) {
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

  if (inner.imageMessage) {
    return { type: 'image', media: inner.imageMessage, caption: inner.imageMessage.caption || '' };
  }
  if (inner.videoMessage) {
    return { type: 'video', media: inner.videoMessage, caption: inner.videoMessage.caption || '' };
  }
  if (inner.audioMessage) {
    return { type: 'audio', media: inner.audioMessage, caption: inner.audioMessage.caption || '' };
  }
  return null;
}

async function downloadMedia(mediaInfo) {
  const stream = await downloadContentFromMessage(mediaInfo.media, mediaInfo.type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

module.exports = {
  name: 'ss',
  aliases: ['save', 'savestatus', 'savestat', 'statusave'],
  category: 'general',
  description: 'Save a replied status into the current chat',
  usage: '.ss (reply to a status)',
  ownerOnly: false,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;

      console.log('[SS] === Triggered ===');
      console.log('[SS] chatId:', chatId);
      console.log('[SS] isOwner:', isOwner);
      console.log('[SS] has quoted:', !!quoted);

      if (!quoted) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Reply to a status with ${settings.prefix || '.'}ss\n\n${settings.footer}`
        });
        return;
      }

      const mediaInfo = extractMediaFromQuoted(quoted);

      if (!mediaInfo) {
        console.log('[SS] No media found. Structure:', JSON.stringify(quoted).slice(0, 300));
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `No media found in the replied status.\n\n${settings.footer}`
        });
        return;
      }

      console.log('[SS] Media type:', mediaInfo.type);

      let buffer = null;
      try {
        buffer = await downloadMedia(mediaInfo);
        console.log('[SS] Downloaded:', buffer?.length || 0, 'bytes');
      } catch (e) {
        console.log('[SS] Download failed:', e.message);
      }

      if (!buffer || buffer.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Download failed. Status may have expired.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // SEND TO CURRENT CHAT (the DM with the poster)
      // ─────────────────────────────────────────
      const sender = mek.key.participant || mek.key.remoteJid;
      const senderNum = String(sender).split('@')[0].split(':')[0];

      const caption =
        `SAVED STATUS\n\n` +
        `From: ${senderNum}\n` +
        `Time: ${new Date().toLocaleString()}\n\n` +
        `${mediaInfo.caption ? 'Caption:\n' + mediaInfo.caption + '\n\n' : ''}` +
        `${settings.footer}`;

      const content = { caption };
      if (mediaInfo.type === 'image') content.image = buffer;
      else if (mediaInfo.type === 'video') content.video = buffer;
      else if (mediaInfo.type === 'audio') { content.audio = buffer; content.ptt = true; }

      await conn.sendMessage(chatId, content);
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      console.log('[SS] ✅ Sent to chat:', chatId.split('@')[0]);

    } catch (error) {
      console.log('[SS] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
    }
  }
};