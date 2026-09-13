/**
 * NEXORA MD - Post Video Status
 * Usage: reply to a video with .statusvid [caption]
 */

const settings = require('../../settings');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

function extractVideo(quoted) {
  if (!quoted) return null;
  let inner = quoted;
  if (quoted.viewOnceMessageV2?.message) inner = quoted.viewOnceMessageV2.message;
  else if (quoted.viewOnceMessage?.message) inner = quoted.viewOnceMessage.message;
  else if (quoted.viewOnceMessageV2Extension?.message) inner = quoted.viewOnceMessageV2Extension.message;

  if (inner.videoMessage) return { type: 'video', media: inner.videoMessage };
  return null;
}

async function downloadMedia(mediaInfo) {
  const stream = await downloadContentFromMessage(mediaInfo.media, mediaInfo.type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

module.exports = {
  name: 'statusvid',
  aliases: ['statusvideo', 'vidstatus'],
  category: 'owner',
  description: 'Post a video status',
  usage: '.statusvid [caption] (reply to a video)',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage
                  || mek.message?.videoMessage;
      const videoInfo = extractVideo(quoted);

      if (!videoInfo) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Reply to a video with ${settings.prefix || '.'}statusvid to post it as a status.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      let buffer = null;
      try { buffer = await downloadMedia(videoInfo); }
      catch (e) { console.log('[STATUSVID] Download failed:', e.message); }

      if (!buffer || buffer.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Download failed.\n\n${settings.footer}`
        });
        return;
      }

      const caption = args.join(' ').trim();

      await conn.sendMessage('status@broadcast', {
        video: buffer,
        caption: caption || undefined
      });

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `Video status posted.\n\n${settings.footer}`
      });

    } catch (error) {
      console.log('[STATUSVID] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};