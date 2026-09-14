const settings = require('../../settings');
const owner = require('../../lib/owner');

module.exports = {
  name: 'owner',
  aliases: ['dev', 'developer'],
  category: 'general',
  description: 'Show owner info',
  usage: '.owner',
  react: '✅',
  async execute(conn, mek, args, chatId, isOwner) {
    await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

    const info = settings.ownerInfo || {};

    // Default to paired bot number if settings hasn't been customized
    const pairedNumber = conn && conn.user
      ? owner.cleanNumber(conn.user.id)
      : 'unknown';

    // Only show custom contact if user has edited settings.js (not default Rodgers value)
    const isCustomized = info.contact && info.contact !== "+254755660053";
    const displayContact = isCustomized ? info.contact : ('+' + pairedNumber);

    // Mask for privacy in logs/status
    const maskedPaired = owner.maskNumber(pairedNumber);

    const text = `NEXORA MD OWNER

Name: ${info.name || 'Bot Owner'}
Role: ${info.role || 'Developer and Owner'}
Location: ${info.location || 'Not set'}
Status: ${info.status || 'Online'}

Contact: ${displayContact}
Report Issues: ${info.report || 'Not set'}
Support: ${info.support || 'Not set'}

GitHub: ${info.github || 'Not set'}
Email: ${info.email || 'Not set'}
Channel: ${info.channel || 'Not set'}

Paired Number: ${maskedPaired}

${settings.footer}`;

    await conn.sendMessage(chatId, { text });
  }
};