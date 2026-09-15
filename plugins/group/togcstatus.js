/**
 * NEXORA MD - Group Status (Group Story)
 * Posts a native WhatsApp group story visible only to group members
 * Reply to image/video/audio/sticker, or pass text
 */

const settings = require('../../settings');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { PassThrough } = require('stream');
const { exec } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const PURPLE_BG = '#9C27B0';

// ─────────────────────────────────────────────
// MEDIA HELPERS
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

// ─────────────────────────────────────────────
// AUDIO CONVERSION
// ─────────────────────────────────────────────
function convertToVoiceNote(buffer) {
  return new Promise((resolve, reject) => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks = [];
    input.end(buffer);

    const ff = exec(
      `"${ffmpegPath}" -i pipe:0 -vn -acodec libopus -f ogg -ar 48000 -ac 1 pipe:1`,
      { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }
    );

    // Simple fallback — if conversion fails, return raw
    resolve(buffer);
  });
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
// ADMIN CHECK
// ─────────────────────────────────────────────
async function isSenderAdmin(conn, groupId, senderJid) {
  try {
    const meta = await conn.groupMetadata(groupId);
    const cleanNum = (s) => String(s || '').split('@')[0].split(':')[0];
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
    const cleanNum = (s) => String(s || '').split('@')[0].split(':')[0];
    const me = meta.participants.find(p => cleanNum(p.id) === cleanNum(botJid));
    if (!me) return false;
    return me.admin === 'admin' || me.admin === 'superadmin';
  } catch (e) {
    return false;
  }
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'groupstatus',
  aliases: ['gcstatus', 'gstatus', 'togcstatus'],
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

      // ─────────────────────────────────────────
      // PERMISSIONS
      // ─────────────────────────────────────────
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
      // READ REPLY / TEXT
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
              `Reply to image / video / audio / sticker:\n` +
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
          text: `Unsupported media. Reply to image, video, audio, or sticker.\n\n${settings.footer}`
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
        if (mediaType === 'audio') {
          await postGroupStatus(conn, chatId, {
            audio: buffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
          });
        } else if (mediaType === 'sticker') {
          await postGroupStatus(conn, chatId, {
            sticker: buffer
          });
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