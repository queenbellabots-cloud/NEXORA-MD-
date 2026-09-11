const settings = require('../../settings');

module.exports = {
  name: 'tagall',
  aliases: ['everyone', 'mentionall'],
  category: 'group',
  description: 'Mention all members',
  usage: '.tagall [message]',
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

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      const meta = await conn.groupMetadata(chatId);
      const participants = meta.participants.map(p => p.id);

      const customMsg = args.join(' ') || 'Attention everyone';

      let text = `${customMsg}\n\n`;
      participants.forEach(p => {
        text += `@${p.split('@')[0]}\n`;
      });

      text += `\n${settings.footer}`;

      await conn.sendMessage(chatId, {
        text,
        mentions: participants
      });
    } catch (error) {
      await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Error: ${error.message}` });
    }
  }
};