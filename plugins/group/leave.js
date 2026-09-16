/**
 * NEXORA MD - Leave Group
 * Usage:
 *   .leave           → leave current group
 *   .leave <groupid> → owner only, leave specific group
 */

const settings = require('../../settings');

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

module.exports = {
  name: 'leave',
  aliases: ['exit', 'leavegc', 'leavegroup'],
  category: 'group',
  description: 'Leave the current group',
  usage: '.leave',
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

      const sender = mek.key.participant || mek.key.remoteJid;
      const senderIsAdmin = await isSenderAdmin(conn, chatId, sender);

      if (!senderIsAdmin && !isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Only admins or the bot owner can make the bot leave.\n\n${settings.footer}`
        });
        return;
      }

      // Get group name for the goodbye message
      let groupName = 'this group';
      try {
        const meta = await conn.groupMetadata(chatId);
        groupName = meta.subject || 'this group';
      } catch (e) {}

      // React and warn
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      await conn.sendMessage(chatId, {
        text: `Leaving ${groupName}...\n\n${settings.footer}`
      });

      // Small delay so the message sends before we leave
      await new Promise(r => setTimeout(r, 1500));

      // Leave the group
      try {
        await conn.groupLeave(chatId);
        console.log('[LEAVE] Left group:', chatId);
      } catch (e) {
        console.log('[LEAVE] Failed to leave:', e.message);
        // Try to notify if we're still in the group
        try {
          await conn.sendMessage(chatId, {
            text: `Failed to leave: ${e.message}\n\n${settings.footer}`
          });
        } catch (x) {}
      }

    } catch (error) {
      console.log('[LEAVE] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
    }
  }
};