/**
 * NEXORA MD - Catbox Uploader (fixed)
 */

const settings = require('../../settings');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');
const axios = require('axios');

function extractMedia(quoted) {
  if (!quoted) return null;
  let inner = quoted;

  if (quoted.viewOnceMessageV2?.message) inner = quoted.viewOnceMessageV2.message;
  else if (quoted.viewOnceMessage?.message) inner = quoted.viewOnceMessage.message;
  else if (quoted.viewOnceMessageV2Extension?.message) inner = quoted.viewOnceMessageV2Extension.message;
  else if (quoted.documentWithCaptionMessage?.message) inner = quoted.documentWithCaptionMessage.message;

  // Sticker → treat as document-like (Baileys uses 'sticker' internally but downloadContentFromMessage accepts it via 'sticker' too)
  if (inner.imageMessage) {
    return { type: 'image', media: inner.imageMessage, mime: inner.imageMessage.mimetype || 'image/jpeg' };
  }
  if (inner.videoMessage) {
    return { type: 'video', media: inner.videoMessage, mime: inner.videoMessage.mimetype || 'video/mp4' };
  }
  if (inner.audioMessage) {
    return { type: 'audio', media: inner.audioMessage, mime: inner.audioMessage.mimetype || 'audio/mpeg' };
  }
  if (inner.documentMessage) {
    return {
      type: 'document',
      media: inner.documentMessage,
      mime: inner.documentMessage.mimetype || 'application/octet-stream',
      fileName: inner.documentMessage.fileName
    };
  }
  if (inner.stickerMessage) {
    return { type: 'sticker', media: inner.stickerMessage, mime: 'image/webp' };
  }

  return null;
}

async function downloadMedia(mediaInfo) {
  // downloadContentFromMessage needs a "type" it recognises.
  // 'sticker' maps to 'sticker', which Baileys understands.
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

module.exports = {
  name: 'catbox',
  aliases: ['cbox', 'upload'],
  category: 'general',
  description: 'Upload media to catbox.moe',
  usage: '.catbox (reply to media)',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      // Get quoted
      const contextInfo =
        mek.message?.extendedTextMessage?.contextInfo ||
        mek.message?.imageMessage?.contextInfo ||
        mek.message?.videoMessage?.contextInfo ||
        mek.message?.audioMessage?.contextInfo ||
        mek.message?.documentMessage?.contextInfo ||
        mek.message?.stickerMessage?.contextInfo;

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

      console.log('[CATBOX] Media type:', mediaInfo.type, '| mime:', mediaInfo.mime);

      await conn.sendMessage(chatId, { react: { text: '⏳', key: mek.key } });

      // Download
      let buffer = null;
      try {
        buffer = await downloadMedia(mediaInfo);
      } catch (e) {
        console.log('[CATBOX] Download failed:', e.message);
      }

      if (!buffer || buffer.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Failed to download media (empty buffer).\n\n${settings.footer}`
        });
        return;
      }

      console.log('[CATBOX] Buffer size:', buffer.length, 'bytes');

      // Build filename
      const ext = extFromMime(mediaInfo.mime, mediaInfo.type === 'sticker' ? 'webp' : 'bin');
      const fileName = mediaInfo.fileName || `nexora_${Date.now()}.${ext}`;

      // Upload to catbox
      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('fileToUpload', buffer, { filename: fileName });

      let uploadUrl = null;
      let apiResponse = '';

      try {
        const res = await axios.post('https://catbox.moe/user/api.php', form, {
          headers: {
            ...form.getHeaders(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*'
          },
          timeout: 120000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        });

        apiResponse = (res.data || '').toString().trim();
        console.log('[CATBOX] API response:', apiResponse);

        if (apiResponse.startsWith('https://')) {
          uploadUrl = apiResponse;
        }
      } catch (upErr) {
        console.log('[CATBOX] Upload error:', upErr.message);
        if (upErr.response) {
          console.log('[CATBOX] Status:', upErr.response.status);
          console.log('[CATBOX] Body:', (upErr.response.data || '').toString().slice(0, 200));
        }
      }

      if (!uploadUrl) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Catbox upload failed.\n\n` +
            `Response: ${apiResponse || '(empty)'}\n` +
            `Size sent: ${(buffer.length / 1024).toFixed(2)} KB\n\n` +
            `Catbox is often down or rate-limited. Try again in a minute.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `UPLOADED\n\n` +
          `Type: ${mediaInfo.type}\n` +
          `Size: ${(buffer.length / 1024).toFixed(2)} KB\n\n` +
          `URL:\n${uploadUrl}\n\n` +
          `${settings.footer}`
      }, { quoted: mek });

      console.log('[CATBOX] Success:', uploadUrl);
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