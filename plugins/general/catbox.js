/**
 * NEXORA MD - Catbox Uploader
 * Uploads replied media to catbox.moe
 * Usage:
 *   .catbox (reply to image/video/audio/document/sticker)
 */

const settings = require('../../settings');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');
const axios = require('axios');

// ─────────────────────────────────────────────
// EXTRACT MEDIA FROM QUOTED MESSAGE
// ─────────────────────────────────────────────
function extractMedia(quoted) {
  if (!quoted) return null;
  let inner = quoted;

  if (quoted.viewOnceMessageV2?.message) inner = quoted.viewOnceMessageV2.message;
  else if (quoted.viewOnceMessage?.message) inner = quoted.viewOnceMessage.message;
  else if (quoted.viewOnceMessageV2Extension?.message) inner = quoted.viewOnceMessageV2Extension.message;
  else if (quoted.documentWithCaptionMessage?.message) inner = quoted.documentWithCaptionMessage.message;

  if (inner.imageMessage) return { type: 'image', media: inner.imageMessage, mime: inner.imageMessage.mimetype || 'image/jpeg' };
  if (inner.videoMessage) return { type: 'video', media: inner.videoMessage, mime: inner.videoMessage.mimetype || 'video/mp4' };
  if (inner.audioMessage) return { type: 'audio', media: inner.audioMessage, mime: inner.audioMessage.mimetype || 'audio/mpeg' };
  if (inner.documentMessage) return { type: 'document', media: inner.documentMessage, mime: inner.documentMessage.mimetype || 'application/octet-stream', fileName: inner.documentMessage.fileName };
  if (inner.stickerMessage) return { type: 'sticker', media: inner.stickerMessage, mime: 'image/webp' };

  return null;
}

async function downloadMedia(mediaInfo) {
  const stream = await downloadContentFromMessage(mediaInfo.media, mediaInfo.type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function extFromMime(mime, fallback = 'bin') {
  if (!mime) return fallback;
  const parts = mime.split('/');
  return parts[1] ? parts[1].split(';')[0] : fallback;
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'catbox',
  aliases: ['cbox', 'upload'],
  category: 'general',
  description: 'Upload media to catbox.moe and get a permanent link',
  usage: '.catbox (reply to media)',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      // ─────────────────────────────────────────
      // 1. Get quoted media
      // ─────────────────────────────────────────
      const contextInfo =
        mek.message?.extendedTextMessage?.contextInfo ||
        mek.message?.imageMessage?.contextInfo ||
        mek.message?.videoMessage?.contextInfo ||
        mek.message?.audioMessage?.contextInfo ||
        mek.message?.documentMessage?.contextInfo;

      const quoted = contextInfo?.quotedMessage;

      if (!quoted) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Upload to catbox.moe\n\n` +
            `Reply to an image, video, audio, sticker, or document with ${settings.prefix || '.'}catbox\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const mediaInfo = extractMedia(quoted);
      if (!mediaInfo) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `No supported media found in the replied message.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 2. React
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, { react: { text: '⏳', key: mek.key } });

      // ─────────────────────────────────────────
      // 3. Download media
      // ─────────────────────────────────────────
      let buffer = null;
      try {
        buffer = await downloadMedia(mediaInfo);
      } catch (e) {
        console.log('[CATBOX] Download failed:', e.message);
      }

      if (!buffer || buffer.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Failed to download media.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 4. Upload to catbox
      // ─────────────────────────────────────────
      const ext = extFromMime(mediaInfo.mime);
      const fileName = mediaInfo.fileName || `nexora_${Date.now()}.${ext}`;

      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('fileToUpload', buffer, { filename: fileName });

      let uploadUrl = null;
      try {
        const res = await axios.post('https://catbox.moe/user/api.php', form, {
          headers: form.getHeaders(),
          timeout: 90000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        });

        uploadUrl = (res.data || '').trim();
      } catch (upErr) {
        console.log('[CATBOX] Upload failed:', upErr.message);
      }

      if (!uploadUrl || !uploadUrl.startsWith('https://')) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Upload failed.\n\n` +
            `Response: ${uploadUrl || 'empty'}\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 5. Send result
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `UPLOADED\n\n` +
          `Type: ${mediaInfo.type}\n` +
          `Size: ${(buffer.length / 1024).toFixed(2)} KB\n\n` +
          `URL:\n${uploadUrl}\n\n` +
          `${settings.footer}`
      }, { quoted: mek });

      console.log('[CATBOX] Uploaded:', uploadUrl);
    } catch (error) {
      console.log('[CATBOX] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};