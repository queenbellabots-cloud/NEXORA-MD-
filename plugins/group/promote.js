const settings = require('../../settings');

module.exports = {
  name: 'promote',
  aliases: ['admin'],
  category: 'group',
  description: 'Promote a member to admin',
  usage: '.promote @user',
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
        await conn.sendMessage(chatId, { text: 'Tag or reply to the user you want to promote.' });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      await conn.groupParticipantsUpdate(chatId, [target], 'promote');

      await conn.sendMessage(chatId, {
        text: `Promoted @${target.split('@')[0]} to admin.\n\n${settings.footer}`,
        mentions: [target]
      });
    } catch (error) {
      await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Error: ${error.message}` });
    }
  }
};