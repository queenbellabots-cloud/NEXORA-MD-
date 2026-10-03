/**
 * NEXORA MD - Save Replied Status
 * Save a status to your DM instantly
 * Usage: reply to a status with .ss (or .save, .savestatus)
 */

const settings = require('../../settings');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ownerLib = require('../../lib/owner');

// ─────────────────────────────────────────────
// DEEP MEDIA EXTRACTION (unwraps all known wrappers)
// ─────────────────────────────────────────
function extractMediaFromQuoted(quoted) {
  if (!quoted) return null;

  // Try up to 4 layers of unwrapping
  let inner = quoted;
  for (let i = 0; i < 4; i++) {
    const wrapper =
      inner.viewOnceMessageV2?.message ||
      inner.viewOnceMessage?.message ||
      inner.viewOnceMessageV2Extension?.message ||
      inner.documentWithCaptionMessage?.message ||
      inner.ephemeralMessage?.message ||
      inner.statusMentionMessage?.message;

    if (wrapper) {
      inner = wrapper;
    } else {
      break;
    }
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
  category: 'owner',
  description: 'Save a replied status to your DM instantly',
  usage: '.ss (reply to a status)',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    const startTime = Date.now();

    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      // ─────────────────────────────────────────
      // DEBUG: Log structure
      // ─────────────────────────────────────────
      const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;

      console.log('[SS] === Triggered ===');
      console.log('[SS] chatId:', chatId);
      console.log('[SS] has contextInfo:', !!contextInfo);
      console.log('[SS] has quoted:', !!quoted);

      if (quoted) {
        console.log('[SS] quoted keys:', Object.keys(quoted));
      }

      // ─────────────────────────────────────────
      // No quoted → show usage
      // ─────────────────────────────────────────
      if (!quoted) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Save a status to your DM\n\n` +
            `Usage:\n` +
            `  Reply to a status with ${settings.prefix || '.'}ss\n\n` +
            `Note: reply from inside WhatsApp's status viewer.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // Extract media
      // ─────────────────────────────────────────
      const mediaInfo = extractMediaFromQuoted(quoted);

      if (!mediaInfo) {
        console.log('[SS] No media found. Structure:');
        console.log(JSON.stringify(quoted, null, 2).slice(0, 600));

        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `No media found in the replied status.\n\n` +
            `Possible reasons:\n` +
            `- Status is older than 24 hours (expired)\n` +
            `- Status is text-only (no media)\n` +
            `- WhatsApp didn't share the media with us\n\n` +
            `${settings.footer}`
        });
        return;
      }

      console.log('[SS] Media type:', mediaInfo.type);

      // ─────────────────────────────────────────
      // Download
      // ─────────────────────────────────────────
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
      // Send to owner DM
      // ─────────────────────────────────────────
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

      const elapsed = Date.now() - startTime;
      console.log('[SS] Sent to owner in', elapsed, 'ms');

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `Status saved to your DM (${(buffer.length / 1024).toFixed(1)} KB)\n\n${settings.footer}`
      });

    } catch (error) {
      console.log('[SS] Error:', error.message);
      console.log('[SS] Stack:', error.stack);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};