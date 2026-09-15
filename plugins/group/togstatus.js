/**
 * NEXORA MD - Group Status (Group Story)
 * Posts a native WhatsApp group story visible only to group members
 * Reply to image/video/sticker, or pass text
 * No ffmpeg dependency
 */

const settings = require('../../settings');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const PURPLE_BG = '#9C27B0';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function detectMediaType(message) {
  if (!message || typeof message !== 'object') return null;
  if (message.imageMessage) return 'image';
  if (message.videoMessage) return 'video';
  if (message.audioMessage) return 'audio';
  if (message.stickerMessage) return 'sticker';
  return null;
}

function unwrapQuotedMessage(message) {
  let current = message;
  for (let i = 0; i < 4; i++) {
    const wrapper =
      current?.viewOnceMessageV2 ||
      current?.viewOnceMessage ||
      current?.viewOnceMessageV2Extension ||
      current?.documentWithCaptionMessage;
    if (!wrapper?.message) break;
    current = wrapper.message;
  }
  return current;
}

async function downloadMedia(message, type) {
  const mediaMessage = message[`${type}Message`];
  if (!mediaMessage) throw new Error(`Missing ${type} payload`);
  const stream = await downloadContentFromMessage(mediaMessage, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function cleanNum(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

async function isSenderAdmin(conn, groupId, senderJid) {
  try {
    const meta = await conn.groupMetadata(groupId);
    const me = meta.participants.find(p => cleanNum(p.id) === cleanNum(senderJid));
    if (!me) return false;
    return me.admin === 'admin' || me.admin === 'superadmin';
  } catch (e) {
    return false;
  }
}

async function isBotAdmin(conn, groupId) {
  try {
    const meta = await conn.groupMetadata(groupId);
    const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
    const me = meta.participants.find(p => cleanNum(p.id) === cleanNum(botJid));
    if (!me) return false;
    return me.admin === 'admin' || me.admin === 'superadmin';
  } catch (e) {
    return false;
  }
}

// ─────────────────────────────────────────────
// GROUP STATUS POSTER
// ─────────────────────────────────────────────
async function postGroupStatus(conn, jid, content) {
  const statusSourceType = content.text
    ? 'TEXT'
    : content.image
      ? 'IMAGE'
      : content.video
        ? 'VIDEO'
        : content.audio
          ? 'AUDIO'
          : content.sticker
            ? 'IMAGE'
            : 'TEXT';

  return conn.sendMessage(jid, {
    ...content,
    contextInfo: {
      ...(content.contextInfo || {}),
      isGroupStatus: true,
      statusSourceType,
      statusAttributions: [{ type: 10 }],
      statusAudienceMetadata: { audienceType: 'CLOSE_FRIENDS' }
    }
  });
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'groupstatus',
  aliases: ['gcstatus', 'gstatus', 'togcstatus', 'statusgc'],
  category: 'group',
  description: 'Post a group status (visible only to group members)',
  usage: '.groupstatus <text> OR reply to media with .groupstatus',
  groupOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const isGroup = chatId.endsWith('@g.us');
      if (!isGroup) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `This command only works in a group.\n\n${settings.footer}`
        });
        return;
      }

      // Permissions
      const sender = mek.key.participant || mek.key.remoteJid;
      const senderIsAdmin = await isSenderAdmin(conn, chatId, sender);
      if (!senderIsAdmin && !isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Only admins or the bot owner can post a group status.\n\n${settings.footer}`
        });
        return;
      }

      const botIsAdmin = await isBotAdmin(conn, chatId);
      if (!botIsAdmin) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `I need to be a group admin to post a group status.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // READ QUOTED MEDIA OR TEXT
      // ─────────────────────────────────────────
      const caption = args.join(' ').trim();

      const contextInfo =
        mek.message?.extendedTextMessage?.contextInfo ||
        mek.message?.imageMessage?.contextInfo ||
        mek.message?.videoMessage?.contextInfo ||
        mek.message?.audioMessage?.contextInfo;

      const quotedMessage = contextInfo?.quotedMessage;

      // ─────────────────────────────────────────
      // TEXT-ONLY STATUS
      // ─────────────────────────────────────────
      if (!quotedMessage) {
        if (!caption) {
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          await conn.sendMessage(chatId, {
            text:
              `Group Status\n\n` +
              `Reply to image / video / sticker:\n` +
              `  ${settings.prefix || '.'}groupstatus [caption]\n\n` +
              `Or post a text status:\n` +
              `  ${settings.prefix || '.'}groupstatus Your text here\n\n` +
              `${settings.footer}`
          });
          return;
        }

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Posting text group status...`
        });

        try {
          await postGroupStatus(conn, chatId, {
            text: caption,
            backgroundColor: PURPLE_BG
          });
          await conn.sendMessage(chatId, {
            text: `Text group status posted.\n\n${settings.footer}`
          });
        } catch (err) {
          console.log('[GROUPSTATUS] Text post failed:', err.message);
          await conn.sendMessage(chatId, {
            text: `Failed: ${err.message}\n\n${settings.footer}`
          });
        }
        return;
      }

      // ─────────────────────────────────────────
      // MEDIA STATUS
      // ─────────────────────────────────────────
      const mediaPayload = unwrapQuotedMessage(quotedMessage);
      const mediaType = detectMediaType(mediaPayload);
      if (!mediaType) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Unsupported media. Reply to image, video, or sticker.\n\n${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `Preparing ${mediaType} group status...`
      });

      let buffer = null;
      try {
        buffer = await downloadMedia(mediaPayload, mediaType);
      } catch (dlErr) {
        console.log('[GROUPSTATUS] Download failed:', dlErr.message);
      }

      if (!buffer || buffer.length === 0) {
        await conn.sendMessage(chatId, {
          text: `Failed to download the replied media.\n\n${settings.footer}`
        });
        return;
      }

      try {
        if (mediaType === 'sticker') {
          await postGroupStatus(conn, chatId, { sticker: buffer });
        } else {
          await postGroupStatus(conn, chatId, {
            [mediaType]: buffer,
            caption
          });
        }

        await conn.sendMessage(chatId, {
          text: `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} group status posted.\n\n${settings.footer}`
        });
      } catch (postErr) {
        console.log('[GROUPSTATUS] Post failed:', postErr.message);
        await conn.sendMessage(chatId, {
          text: `Failed to post: ${postErr.message}\n\n${settings.footer}`
        });
      }

    } catch (error) {
      console.log('[GROUPSTATUS] Error:', error.message);
      try {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
      } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};