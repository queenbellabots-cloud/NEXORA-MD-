const settings = require('../../settings');

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

    const text = `NEXORA MD OWNER

Name: ${info.name || 'Rodgers Onyango'}
Role: ${info.role || 'Developer and Owner'}
Location: ${info.location || 'Kisumu, Kenya'}
Current Loc: ${info.currentLoc || 'Nakuru, Kenya'}
Girlfriend: ${info.girlfriend || 'Currently Single'}
Status: ${info.status || 'Taken by the code'}

Contact: ${info.contact || '+254755660053'}
Report Issues: ${info.report || '+254716388654'}
Support: ${info.support || '+254755660053'}

GitHub: https://github.com/queenbellabots-cloud/NEXORA-MD-
Email: rogersonyango87@gmail.com
Channel: ${info.channel || 'https://whatsapp.com/channel/0029VbCwZHACXC3PNHgtMT31'}

${settings.footer}`;

    await conn.sendMessage(chatId, { text });
  }
};