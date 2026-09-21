/**
 * NEXORA MD - Silent View-Once Revealer
 * Owner replies to a view-once with .<emoji> → media sent silently to owner DM
 * No reaction, no reply, no trace in the original chat
 * Usage: reply to a view-once with .😀 (any emoji after dot)
 */

const settings = require('../../settings');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const owner = require('../../lib/owner');

function extractViewOnce(quoted) {
  if (!quoted) return null;
  let inner = quoted;

  if (quoted.viewOnceMessageV2?.message) inner = quoted.viewOnceMessageV2.message;
  else if (quoted.viewOnceMessage?.message) inner = quoted.viewOnceMessage.message;
  else if (quoted.viewOnceMessageV2Extension?.message) inner = quoted.viewOnceMessageV2Extension.message;

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

function cleanNum(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function isEmojiText(text) {
  if (!text) return false;
  const emojiRegex = /^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}]+$/u;
  return emojiRegex.test(text);
}

module.exports = {
  name: 'silentvv',
  aliases: ['svv', 'silent'],
  category: 'owner',
  description: 'Silently reveal a view-once to owner DM',
  usage: 'Reply to a view-once with .<emoji>',
  ownerOnly: true,
  react: '✅',

  // This plugin is actually handled by main.js, but registered here so it
  // appears in the menu
  async execute(conn, mek, args, chatId, isOwner) {
    // Placeholder — actual logic is in the watcher below
    try {
      const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      if (!quoted) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const mediaInfo = extractViewOnce(quoted);
      if (!mediaInfo) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      // Silent — no reaction, no reply. Owner check happens in main.js
      await silentRevealToOwner(conn, mek, chatId, mediaInfo);
    } catch (error) {
      console.log('[SILENTVV] Error:', error.message);
    }
  }
};

// ═══════════════════════════════════════════════════════
// SILENT REVEAL — sends media to owner DM, no trace
// ═══════════════════════════════════════════════════════
async function silentRevealToOwner(conn, mek, chatId, mediaInfo) {
  try {
    const buffer = await downloadMedia(mediaInfo);
    if (!buffer || buffer.length === 0) return false;

    const ownerNum = (owner.getPairedNumber && owner.getPairedNumber()) || settings.ownerNumber;
    if (!ownerNum) return false;

    const ownerJid = ownerNum.includes('@') ? ownerNum : ownerNum + '@s.whatsapp.net';

    const sender = mek.key.participant || mek.key.remoteJid;
    const senderNum = cleanNum(sender);

    const caption =
      `SILENT REVEAL\n\n` +
      `From: ${senderNum}\n` +
      `Chat: ${chatId.split('@')[0]}\n` +
      `Time: ${new Date().toLocaleString()}\n\n` +
      `${mediaInfo.caption ? `Caption:\n${mediaInfo.caption}\n\n` : ''}` +
      `${settings.footer}`;

    const content = { caption };
    if (mediaInfo.type === 'image') content.image = buffer;
    else if (mediaInfo.type === 'video') content.video = buffer;
    else if (mediaInfo.type === 'audio') { content.audio = buffer; content.ptt = true; }

    await conn.sendMessage(ownerJid, content);
    console.log('[SILENTVV] Revealed to owner:', senderNum);
    return true;
  } catch (error) {
    console.log('[SILENTVV] Reveal failed:', error.message);
    return false;
  }
}

module.exports.silentRevealToOwner = silentRevealToOwner;