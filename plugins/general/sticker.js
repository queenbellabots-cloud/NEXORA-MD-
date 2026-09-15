/**
 * NEXORA MD - Sticker Command
 * Reply to an image, video, or GIF with .sticker to convert it
 */

const settings = require('../../settings');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEMP_DIR = './data/tmp';
const STICKER_PACK = settings.botName || 'NEXORA MD';
const STICKER_AUTHOR = settings.botOwner || 'Rodgers';

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function tmpFile(ext) {
  const id = crypto.randomBytes(8).toString('hex');
  return path.join(TEMP_DIR, `${id}.${ext}`);
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    exec(`ffmpeg ${args}`, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

async function downloadMedia(mediaInfo) {
  const stream = await downloadContentFromMessage(mediaInfo.media, mediaInfo.type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function extractMedia(quoted) {
  if (!quoted) return null;
  let inner = quoted;

  if (quoted.viewOnceMessageV2?.message) inner = quoted.viewOnceMessageV2.message;
  else if (quoted.viewOnceMessage?.message) inner = quoted.viewOnceMessage.message;
  else if (quoted.viewOnceMessageV2Extension?.message) inner = quoted.viewOnceMessageV2Extension.message;

  if (inner.imageMessage) return { type: 'image', media: inner.imageMessage };
  if (inner.videoMessage) return { type: 'video', media: inner.videoMessage };
  if (inner.stickerMessage) return { type: 'sticker', media: inner.stickerMessage };
  return null;
}

module.exports = {
  name: 'sticker',
  aliases: ['s', 'stiker', 'toimage'],
  category: 'general',
  description: 'Convert an image or video into a WhatsApp sticker',
  usage: '.sticker (reply to image or video)',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    let inputPath = null;
    let outputPath = null;

    try {
      // ─────────────────────────────────────────
      // 1. Get the replied media
      // ─────────────────────────────────────────
      const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quoted) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Reply to an image or video with ${settings.prefix || '.'}sticker\n\n` +
            `Works on:\n` +
            `  - Image\n` +
            `  - Video (up to 10 seconds)\n` +
            `  - GIF\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const mediaInfo = extractMedia(quoted);
      if (!mediaInfo) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `No image or video found in the replied message.\n\n${settings.footer}`
        });
        return;
      }

      if (mediaInfo.type === 'sticker') {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `That's already a sticker.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 2. React and download
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, { react: { text: '⏳', key: mek.key } });

      const buffer = await downloadMedia(mediaInfo);
      if (!buffer || buffer.length === 0) {
        throw new Error('Download failed');
      }

      // ─────────────────────────────────────────
      // 3. Convert to webp via ffmpeg
      // ─────────────────────────────────────────
      const inExt = mediaInfo.type === 'video' ? 'mp4' : 'jpg';
      inputPath = tmpFile(inExt);
      outputPath = tmpFile('webp');

      fs.writeFileSync(inputPath, buffer);

      if (mediaInfo.type === 'image') {
        // Image → webp sticker
        await runFFmpeg(
          `-i "${inputPath}" ` +
          `-vf "scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" ` +
          `-y "${outputPath}"`
        );
      } else {
        // Video/GIF → animated webp sticker
        await runFFmpeg(
          `-i "${inputPath}" ` +
          `-t 8 ` +
          `-vf "fps=15,scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,pad=512:512:(ow-ih)/2:(oh-ih)/2:color=0x00000000" ` +
          `-c:v libwebp ` +
          `-lossless 0 ` +
          `-compression_level 6 ` +
          `-q:v 70 ` +
          `-loop 0 ` +
          `-preset default ` +
          `-an ` +
          `-vsync 0 ` +
          `-y "${outputPath}"`
        );
      }

      if (!fs.existsSync(outputPath)) {
        throw new Error('Conversion failed');
      }

      const stickerBuffer = fs.readFileSync(outputPath);
      if (stickerBuffer.length === 0) {
        throw new Error('Empty sticker');
      }

      // ─────────────────────────────────────────
      // 4. Send the sticker
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, {
        sticker: stickerBuffer
      }, { quoted: mek });

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

    } catch (error) {
      console.log('[STICKER] Error:', error.message);
      try {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
      } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Failed to create sticker: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    } finally {
      // ─────────────────────────────────────────
      // 5. Cleanup temp files
      // ─────────────────────────────────────────
      try { if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch (e) {}
      try { if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (e) {}
    }
  }
};