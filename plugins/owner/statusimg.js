/**
 * NEXORA MD - Post Image Status
 * Usage: attach or reply to an image, then .statusimg [caption]
 */

const settings = require('../../settings');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

function extractImage(quoted) {
  if (!quoted) return null;
  let inner = quoted;
  if (quoted.viewOnceMessageV2?.message) inner = quoted.viewOnceMessageV2.message;
  else if (quoted.viewOnceMessage?.message) inner = quoted.viewOnceMessage.message;
  else if (quoted.viewOnceMessageV2Extension?.message) inner = quoted.viewOnceMessageV2Extension.message;

  if (inner.imageMessage) return { type: 'image', media: inner.imageMessage };
  return null;
}

async function downloadMedia(mediaInfo) {
  const stream = await downloadContentFromMessage(mediaInfo.media, mediaInfo.type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

module.exports = {
  name: 'statusimg',
  aliases: ['statusimage', 'imgstatus'],
  category: 'owner',
  description: 'Post an image status',
  usage: '.statusimg [caption] (reply to an image)',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage
                  || mek.message?.imageMessage;
      const imageInfo = extractImage(quoted);

      if (!imageInfo) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Reply to an image with ${settings.prefix || '.'}statusimg to post it as a status.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      let buffer = null;
      try { buffer = await downloadMedia(imageInfo); }
      catch (e) { console.log('[STATUSIMG] Download failed:', e.message); }

      if (!buffer || buffer.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Download failed.\n\n${settings.footer}`
        });
        return;
      }

      const caption = args.join(' ').trim();

      await conn.sendMessage('status@broadcast', {
        image: buffer,
        caption: caption || undefined
      });

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `Image status posted.\n\n${settings.footer}`
      });

    } catch (error) {
      console.log('[STATUSIMG] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};