/**
 * NEXORA MD - Status Reshare
 * Reshares a replied status to the bot's own status
 * Usage:
 *   Reply to a status with .reshare
 *   Reply to a status with .reshare <extra caption>
 */

const settings = require('../../settings');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// ─────────────────────────────────────────────
// MEDIA EXTRACTION
// ─────────────────────────────────────────────
function extractMedia(quoted) {
  if (!quoted) return null;
  let inner = quoted;

  if (quoted.viewOnceMessageV2?.message) inner = quoted.viewOnceMessageV2.message;
  else if (quoted.viewOnceMessage?.message) inner = quoted.viewOnceMessage.message;
  else if (quoted.viewOnceMessageV2Extension?.message) inner = quoted.viewOnceMessageV2Extension.message;

  if (inner.imageMessage) return { type: 'image', media: inner.imageMessage, caption: inner.imageMessage.caption || '' };
  if (inner.videoMessage) return { type: 'video', media: inner.videoMessage, caption: inner.videoMessage.caption || '' };
  return null;
}

async function downloadMedia(mediaInfo) {
  const stream = await downloadContentFromMessage(mediaInfo.media, mediaInfo.type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function cleanNum(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'reshare',
  aliases: ['repost', 'share', 'restatus'],
  category: 'general',
  description: 'Reshare a status to the bot\'s own status',
  usage: '.reshare (reply to a status)',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      // ─────────────────────────────────────────
      // Check if it's a status reply
      // ─────────────────────────────────────────
      const contextInfo =
        mek.message?.extendedTextMessage?.contextInfo ||
        mek.message?.imageMessage?.contextInfo ||
        mek.message?.videoMessage?.contextInfo;

      const quoted = contextInfo?.quotedMessage;

      if (!quoted) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Reshare a status\n\n` +
            `Usage:\n` +
            `  Reply to a status with ${settings.prefix || '.'}reshare\n` +
            `  Reply to a status with ${settings.prefix || '.'}reshare <extra caption>\n\n` +
            `How to use:\n` +
            `  1. Open WhatsApp status\n` +
            `  2. Reply to the status you want to reshare\n` +
            `  3. Send ${settings.prefix || '.'}reshare\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // Extract media
      // ─────────────────────────────────────────
      const mediaInfo = extractMedia(quoted);
      if (!mediaInfo) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `No image or video found in the replied status.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // Identify original poster
      // ─────────────────────────────────────────
      const originalPoster = contextInfo?.participant || contextInfo?.remoteJid || 'unknown';
      const posterNum = cleanNum(originalPoster);

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Downloading status...` });

      // ─────────────────────────────────────────
      // Download media
      // ─────────────────────────────────────────
      let buffer = null;
      try {
        buffer = await downloadMedia(mediaInfo);
      } catch (e) {
        console.log('[RESHARE] Download failed:', e.message);
      }

      if (!buffer || buffer.length === 0) {
        await conn.sendMessage(chatId, {
          text: `Failed to download status.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // Build caption with credit
      // ─────────────────────────────────────────
      const extraCaption = args.join(' ').trim();
      const originalCaption = mediaInfo.caption || '';

      let caption = '';

      if (extraCaption) {
        caption += `${extraCaption}\n\n`;
      }

      if (originalCaption) {
        caption += `${originalCaption}\n\n`;
      }

      caption += `— reshared from @${posterNum}`;

      // ─────────────────────────────────────────
      // Post to status
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, { text: `Posting reshared status...` });

      try {
        const content = {
          caption,
          [mediaInfo.type]: buffer
        };

        // Post to status
        await conn.sendMessage('status@broadcast', content, {
          statusJidList: [conn.user.id.split(':')[0] + '@s.whatsapp.net']
        });

        await conn.sendMessage(chatId, {
          text:
            `STATUS RESHARED\n\n` +
            `Original: @${posterNum}\n` +
            `Type: ${mediaInfo.type}\n\n` +
            `${settings.footer}`,
          mentions: [originalPoster]
        });

        console.log('[RESHARE] Posted status reshare from', posterNum);

      } catch (postErr) {
        console.log('[RESHARE] Post failed:', postErr.message);
        await conn.sendMessage(chatId, {
          text: `Failed to post status: ${postErr.message}\n\n${settings.footer}`
        });
      }

    } catch (error) {
      console.log('[RESHARE] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};