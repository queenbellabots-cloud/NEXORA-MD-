/**
 * NEXORA MD - Get Profile Picture
 * Usage:
 *   .getdp              → your own DP
 *   .getdp @user        → mentioned user's DP
 *   .getdp 2547...      → number's DP
 *   .getdp (reply)      → replied user's DP
 */

const settings = require('../../settings');

function cleanNum(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function isValidNumber(n) {
  return /^[0-9]{8,15}$/.test(n);
}

module.exports = {
  name: 'getdp',
  aliases: ['dp', 'pfp', 'profilepic'],
  category: 'general',
  description: 'Get WhatsApp profile picture of a user',
  usage: '.getdp [@user | number | reply]',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
      const mentioned = contextInfo?.mentionedJid || [];
      const quoted = contextInfo?.participant;

      let target = null;
      let source = '';

      // 1. Mentioned user
      if (mentioned.length > 0) {
        target = mentioned[0];
        source = 'mention';
      }
      // 2. Replied user
      else if (quoted) {
        target = quoted;
        source = 'reply';
      }
      // 3. Number argument
      else if (args[0]) {
        const num = cleanNum(args[0]);
        if (isValidNumber(num)) {
          target = num + '@s.whatsapp.net';
          source = 'number';
        } else {
          await conn.sendMessage(chatId, {
            text: `Invalid number: ${args[0]}\n\n${settings.footer}`
          });
          return;
        }
      }
      // 4. Self (no args)
      else {
        target = mek.key.participant || mek.key.remoteJid;
        source = 'self';
      }

      if (!target) {
        await conn.sendMessage(chatId, {
          text: `Could not determine target user.\n\n${settings.footer}`
        });
        return;
      }

      const targetNum = cleanNum(target);

      // Try to fetch profile picture
      let url = null;
      try {
        url = await conn.profilePictureUrl(target, 'image');
      } catch (e) {
        console.log('[GETDP] profilePictureUrl failed:', e.message);
      }

      if (!url) {
        await conn.sendMessage(chatId, {
          text:
            `No profile picture found for ${targetNum}.\n\n` +
            `Possible reasons:\n` +
            `- User has no DP set\n` +
            `- User's privacy blocks DP viewing\n` +
            `- User has blocked the bot\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // Download and send
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());

        const caption =
          `PROFILE PICTURE\n\n` +
          `Number: ${targetNum}\n` +
          `Source: ${source}\n\n` +
          `${settings.footer}`;

        await conn.sendMessage(chatId, {
          image: buffer,
          caption
        });
      } catch (fetchErr) {
        console.log('[GETDP] Download failed:', fetchErr.message);
        // Fallback: send URL as text
        await conn.sendMessage(chatId, {
          text:
            `PROFILE PICTURE URL\n\n` +
            `Number: ${targetNum}\n` +
            `URL: ${url}\n\n` +
            `${settings.footer}`
        });
      }

    } catch (error) {
      console.log('[GETDP] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};