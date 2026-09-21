/**
 * NEXORA MD - Save Replied Status
 * Usage: reply to a status with .savestatus (or .save)
 */

const settings = require('../../settings');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ownerLib = require('../../lib/owner');

function extractMediaFromQuoted(quoted) {
  if (!quoted) return null;

  let inner = quoted;
  if (quoted.viewOnceMessageV2?.message) inner = quoted.viewOnceMessageV2.message;
  else if (quoted.viewOnceMessage?.message) inner = quoted.viewOnceMessage.message;
  else if (quoted.viewOnceMessageV2Extension?.message) inner = quoted.viewOnceMessageV2Extension.message;
  else if (quoted.documentWithCaptionMessage?.message) inner = quoted.documentWithCaptionMessage.message;

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

module.exports = {
  name: 'savestatus',
  aliases: ['save', 'savestat', 'statusave'],
  category: 'owner',
  description: 'Save a replied status to your DM',
  usage: '.savestatus (reply to a status)',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      // ─────────────────────────────────────────
      // DEBUG: Log what we received
      // ─────────────────────────────────────────
      const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;

      console.log('[SAVESTATUS] === DEBUG ===');
      console.log('[SAVESTATUS] chatId:', chatId);
      console.log('[SAVESTATUS] sender:', mek.key.participant || mek.key.remoteJid);
      console.log('[SAVESTATUS] message keys:', Object.keys(mek.message || {}));
      console.log('[SAVESTATUS] has contextInfo:', !!contextInfo);

      if (contextInfo) {
        console.log('[SAVESTATUS] contextInfo keys:', Object.keys(contextInfo));
        console.log('[SAVESTATUS] has quotedMessage:', !!quoted);
      }

      if (quoted) {
        console.log('[SAVESTATUS] quoted keys:', Object.keys(quoted));
      }

      if (!quoted) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Reply to a status with ${settings.prefix || '.'}save\n\n` +
            `Note: reply from inside WhatsApp's status viewer.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const mediaInfo = extractMediaFromQuoted(quoted);

      if (!mediaInfo) {
        console.log('[SAVESTATUS] No media info found. Quoted structure:');
        console.log(JSON.stringify(quoted, null, 2).slice(0, 500));

        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `No media found in the replied message.\n\n${settings.footer}`
        });
        return;
      }

      console.log('[SAVESTATUS] Media type:', mediaInfo.type);

      let buffer = null;
      try {
        buffer = await downloadMedia(mediaInfo);
        console.log('[SAVESTATUS] Downloaded:', buffer?.length || 0, 'bytes');
      } catch (e) {
        console.log('[SAVESTATUS] Download failed:', e.message);
      }

      if (!buffer || buffer.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Download failed. Try again.\n\n${settings.footer}`
        });
        return;
      }

      const owners = ownerLib.getOwnerNumbers(conn);
      const ownerNum = owners[0] || settings.ownerNumber;
      if (!ownerNum) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const ownerJid = ownerNum + '@s.whatsapp.net';
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

      await conn.sendMessage(ownerJid, content);
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `Status saved to your DM.\n\n${settings.footer}`
      });

      console.log('[SAVESTATUS] Sent to owner:', senderNum);

    } catch (error) {
      console.log('[SAVESTATUS] Error:', error.message);
      console.log('[SAVESTATUS] Stack:', error.stack);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};