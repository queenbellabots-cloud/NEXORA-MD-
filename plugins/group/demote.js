const settings = require('../../settings');

module.exports = {
  name: 'demote',
  aliases: ['unadmin'],
  category: 'group',
  description: 'Demote an admin to member',
  usage: '.demote @user',
  groupOnly: true,
  react: '✅',
  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const isGroup = chatId.endsWith('@g.us');
      if (!isGroup) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const senderJid = mek.key.participant || mek.key.remoteJid;

      let isAdmin = false;
      try {
        const meta = await conn.groupMetadata(chatId);
        isAdmin = meta.participants.some(p => p.id === senderJid && (p.admin === 'admin' || p.admin === 'superadmin'));
      } catch (e) {}

      if (!isAdmin && !isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const quoted = mek.message?.extendedTextMessage?.contextInfo?.participant;
      const target = mentioned[0] || quoted;

      if (!target) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, { text: 'Tag or reply to the user you want to demote.' });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      await conn.groupParticipantsUpdate(chatId, [target], 'demote');

      await conn.sendMessage(chatId, {
        text: `Demoted @${target.split('@')[0]} to member.\n\n${settings.footer}`,
        mentions: [target]
      });
    } catch (error) {
      await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Error: ${error.message}` });
    }
  }
};