/**
 * NEXORA MD - Broadcast
 * Send a message to all chats the bot is in (DMs + groups)
 * Usage:
 *   .broadcast <text>              → broadcast text
 *   .broadcast (reply to image)    → broadcast image + caption
 *   .broadcast (reply to video)    → broadcast video + caption
 *   .broadcast groups <text>       → groups only
 *   .broadcast dm <text>           → DMs only
 */

const settings = require('../../settings');
const fs = require('fs');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const DELAY_BETWEEN = 1200; // ms between messages

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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────
// GET ALL CHATS
// ─────────────────────────────────────────────
async function getAllChats(conn) {
  try {
    const chats = await conn.groupFetchAllParticipating();
    return Object.values(chats).map(c => c.id);
  } catch (e) {
    console.log('[BROADCAST] groupFetchAllParticipating failed:', e.message);
    return [];
  }
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'broadcast',
  aliases: ['bc', 'announce'],
  category: 'owner',
  description: 'Send a message to all chats',
  usage: '.broadcast <text> | .broadcast groups <text> | .broadcast dm <text>',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      // ─────────────────────────────────────────
      // PARSE SCOPE + CONTENT
      // ─────────────────────────────────────────
      let scope = 'all';
      let text = args.join(' ').trim();

      const first = (args[0] || '').toLowerCase();
      if (first === 'groups' || first === 'dm') {
        scope = first;
        text = args.slice(1).join(' ').trim();
      }

      const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;
      const mediaInfo = extractMedia(quoted);

      if (!text && !mediaInfo) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Broadcast a message\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}broadcast <text>\n` +
            `  ${settings.prefix || '.'}broadcast groups <text>\n` +
            `  ${settings.prefix || '.'}broadcast dm <text>\n` +
            `  ${settings.prefix || '.'}broadcast (reply to image/video)\n\n` +
            `Scope:\n` +
            `  all    - DMs + groups (default)\n` +
            `  groups - groups only\n` +
            `  dm     - DMs only\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // GATHER TARGETS
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Preparing broadcast (${scope})...` });

      const targets = [];

      if (scope === 'all' || scope === 'groups') {
        const groups = await getAllChats(conn);
        targets.push(...groups);
      }

      if (scope === 'all' || scope === 'dm') {
        // DMs: unique contacts the bot has chatted with
        try {
          const store = require('../../lib/lightweight_store');
          const contacts = Object.keys(store.contacts || {});
          for (const jid of contacts) {
            if (jid.endsWith('@s.whatsapp.net')) {
              targets.push(jid);
            }
          }
        } catch (e) {
          console.log('[BROADCAST] Store read failed:', e.message);
        }
      }

      // Remove duplicates
      const uniqueTargets = [...new Set(targets)];

      if (uniqueTargets.length === 0) {
        await conn.sendMessage(chatId, {
          text: `No chats to broadcast to.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // DOWNLOAD MEDIA IF ANY
      // ─────────────────────────────────────────
      let mediaBuffer = null;
      if (mediaInfo) {
        try {
          mediaBuffer = await downloadMedia(mediaInfo);
        } catch (e) {
          console.log('[BROADCAST] Media download failed:', e.message);
        }
      }

      // ─────────────────────────────────────────
      // BUILD MESSAGE CONTENT
      // ─────────────────────────────────────────
      const broadcastText = text || mediaInfo?.caption || '';
      const content = mediaBuffer && mediaInfo
        ? {
            [mediaInfo.type]: mediaBuffer,
            caption: broadcastText
          }
        : { text: broadcastText };

      // ─────────────────────────────────────────
      // SEND TO ALL TARGETS
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, {
        text: `Broadcasting to ${uniqueTargets.length} chats...`
      });

      let sent = 0;
      let failed = 0;

      for (const target of uniqueTargets) {
        try {
          await conn.sendMessage(target, content);
          sent++;
          console.log(`[BROADCAST] Sent to ${target} (${sent}/${uniqueTargets.length})`);
        } catch (e) {
          failed++;
          console.log(`[BROADCAST] Failed for ${target}: ${e.message}`);
        }

        // Delay between sends to avoid rate-limit
        await sleep(DELAY_BETWEEN);
      }

      // ─────────────────────────────────────────
      // REPORT
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, {
        text:
          `BROADCAST COMPLETE\n\n` +
          `Sent: ${sent}\n` +
          `Failed: ${failed}\n` +
          `Total targets: ${uniqueTargets.length}\n\n` +
          `${settings.footer}`
      });

    } catch (error) {
      console.log('[BROADCAST] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};