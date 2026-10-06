/**
 * NEXORA MD - View-Once Reveal + Delete
 * Reveals the view-once AND deletes the original
 * Usage: reply to a view-once with .vv2
 */

const settings = require('../../settings');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

function extractViewOnce(quoted) {
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
  name: 'vv2',
  aliases: ['vreveal', 'vvd'],
  category: 'general',
  description: 'Reveal a view-once and delete the original',
  usage: '.vv2 (reply to a view-once)',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;
      const quotedKey = contextInfo?.stanzaId;

      if (!quoted) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Reply to a view-once with ${settings.prefix || '.'}vv2\n\n${settings.footer}`
        });
        return;
      }

      const mediaInfo = extractViewOnce(quoted);
      if (!mediaInfo) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `No view-once media found.\n\n${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      const buffer = await downloadMedia(mediaInfo);
      if (!buffer || buffer.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const caption = `VIEW-ONCE REVEALED\n\nTime: ${new Date().toLocaleString()}\n\n${mediaInfo.caption ? 'Caption:\n' + mediaInfo.caption + '\n\n' : ''}${settings.footer}`;

      const content = { caption };
      if (mediaInfo.type === 'image') content.image = buffer;
      else if (mediaInfo.type === 'video') content.video = buffer;
      else if (mediaInfo.type === 'audio') { content.audio = buffer; content.ptt = true; }

      await conn.sendMessage(chatId, content);

      // Try to delete the original view-once
      try {
        await conn.sendMessage(chatId, {
          delete: {
            remoteJid: chatId,
            fromMe: false,
            id: quotedKey,
            participant: contextInfo?.participant
          }
        });
        console.log('[VV2] Original deleted');
      } catch (delErr) {
        console.log('[VV2] Delete failed:', delErr.message);
      }

    } catch (error) {
      console.log('[VV2] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
    }
  }
};