/**
 * NEXORA MD - Create Group Command
 * Creates a group, adds members, promotes bot to admin
 * Owner only
 */

const settings = require('../../settings');

function cleanNumber(num) {
  return String(num || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function isValidNumber(num) {
  return /^[0-9]{8,15}$/.test(num);
}

module.exports = {
  name: 'creategroup',
  aliases: ['newgroup', 'gc', 'creategc'],
  category: 'owner',
  description: 'Create a group with the bot as admin',
  usage: '.creategroup Group Name | 2547..., 2547...',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      // ─────────────────────────────────────────
      // 1. Parse group name and member numbers
      // ─────────────────────────────────────────
      const fullText = args.join(' ').trim();

      if (!fullText) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Create a new group\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}creategroup Group Name\n` +
            `  ${settings.prefix || '.'}creategroup Group Name | 254711111111, 254722222222\n` +
            `  ${settings.prefix || '.'}creategroup Group Name @user1 @user2\n\n` +
            `Notes:\n` +
            `  - Bot will be promoted to admin\n` +
            `  - You are added automatically\n` +
            `  - Numbers must include country code, no + or spaces\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // Split on "|" to separate name from numbers (optional)
      let groupName = fullText;
      let numbersPart = '';

      if (fullText.includes('|')) {
        const parts = fullText.split('|');
        groupName = parts[0].trim();
        numbersPart = parts.slice(1).join('|').trim();
      }

      if (!groupName) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, { text: `Group name is required.\n\n${settings.footer}` });
        return;
      }

      // ─────────────────────────────────────────
      // 2. Collect member numbers
      // ─────────────────────────────────────────
      const memberSet = new Set();

      // Sender always included
      const sender = mek.key.participant || mek.key.remoteJid;
      const senderNumber = cleanNumber(sender);
      if (senderNumber) memberSet.add(senderNumber);

      // Bot itself always included
      const botNumber = cleanNumber(conn.user.id);
      if (botNumber) memberSet.add(botNumber);

      // Mentioned users
      const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      mentioned.forEach(jid => {
        const num = cleanNumber(jid);
        if (num) memberSet.add(num);
      });

      // Quoted user
      const quotedUser = mek.message?.extendedTextMessage?.contextInfo?.participant;
      if (quotedUser) {
        const num = cleanNumber(quotedUser);
        if (num) memberSet.add(num);
      }

      // Numbers from text (comma or space separated)
      if (numbersPart) {
        const tokens = numbersPart.split(/[,\s]+/);
        tokens.forEach(t => {
          const num = cleanNumber(t);
          if (isValidNumber(num)) memberSet.add(num);
        });
      }

      const memberJids = [...memberSet].map(n => n + '@s.whatsapp.net');

      if (memberJids.length < 2) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Need at least one other member to create a group.\n\n` +
            `Add numbers like:\n` +
            `  ${settings.prefix || '.'}creategroup ${groupName} | 254711111111\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 3. Create group
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      let group = null;
      try {
        group = await conn.groupCreate(groupName, memberJids);
      } catch (createErr) {
        console.log('[CREATEGROUP] Create failed:', createErr.message);
        await conn.sendMessage(chatId, {
          text: `Failed to create group: ${createErr.message}\n\n${settings.footer}`
        });
        return;
      }

      if (!group || !group.id) {
        await conn.sendMessage(chatId, {
          text: `Group creation returned no ID.\n\n${settings.footer}`
        });
        return;
      }

      const groupId = group.id;

      // ─────────────────────────────────────────
      // 4. Promote bot to admin
      // ─────────────────────────────────────────
      let promoted = false;
      try {
        const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
        await conn.groupParticipantsUpdate(groupId, [botJid], 'promote');
        promoted = true;
        console.log('[CREATEGROUP] Bot promoted to admin.');
      } catch (promoteErr) {
        console.log('[CREATEGROUP] Promote failed:', promoteErr.message);
      }

      // ─────────────────────────────────────────
      // 5. Get invite link
      // ─────────────────────────────────────────
      let inviteLink = '';
      try {
        const code = await conn.groupInviteCode(groupId);
        if (code) inviteLink = `https://chat.whatsapp.com/${code}`;
      } catch (inviteErr) {
        console.log('[CREATEGROUP] Invite failed:', inviteErr.message);
      }

      // ─────────────────────────────────────────
      // 6. Send group welcome message
      // ─────────────────────────────────────────
      try {
        const groupWelcome =
          `Group created by NEXORA MD\n\n` +
          `Name: ${groupName}\n` +
          `Members: ${memberJids.length}\n` +
          `Bot admin: ${promoted ? 'yes' : 'no'}\n\n` +
          `Commands are available with prefix ${settings.prefix || '.'}\n` +
          `Try ${settings.prefix || '.'}menu\n\n` +
          `${settings.footer}`;

        await conn.sendMessage(groupId, { text: groupWelcome });
      } catch (welcomeErr) {
        console.log('[CREATEGROUP] Group welcome failed:', welcomeErr.message);
      }

      // ─────────────────────────────────────────
      // 7. Report back to owner
      // ─────────────────────────────────────────
      const report =
        `Group created\n\n` +
        `Name: ${groupName}\n` +
        `ID: ${groupId}\n` +
        `Members added: ${memberJids.length}\n` +
        `Bot promoted to admin: ${promoted ? 'yes' : 'no'}\n` +
        (inviteLink ? `Invite link: ${inviteLink}\n` : `Invite link: unavailable\n`) +
        `\n${settings.footer}`;

      // Send to owner in DM
      try {
        const ownerJid = senderNumber ? senderNumber + '@s.whatsapp.net' : chatId;
        if (ownerJid !== chatId) {
          await conn.sendMessage(ownerJid, { text: report });
          await conn.sendMessage(chatId, {
            text: `Group "${groupName}" created. Details sent to your DM.\n\n${settings.footer}`
          });
        } else {
          await conn.sendMessage(chatId, { text: report });
        }
      } catch (reportErr) {
        console.log('[CREATEGROUP] Report failed:', reportErr.message);
        await conn.sendMessage(chatId, { text: report });
      }

    } catch (error) {
      console.log('[CREATEGROUP] Error:', error.message);
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