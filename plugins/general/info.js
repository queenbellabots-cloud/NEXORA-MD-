const settings = require('../../settings');
const { formatTime, formatBytes } = require('../../lib/myfunc');
const startTime = Date.now();

module.exports = {
  name: 'info',
  aliases: ['botinfo', 'status'],
  category: 'general',
  description: 'Show bot info',
  usage: '.info',
  react: '✅',
  async execute(conn, mek, args, chatId, isOwner) {
    await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

    const uptime = formatTime(Date.now() - startTime);
    const mem = formatBytes(process.memoryUsage().rss);
    const totalCommands = global.commands ? global.commands.size : 0;
    const currentMode = global.botMode ? global.botMode.toUpperCase() : 'PUBLIC';

    const text = `${settings.botName}

Owner: ${settings.botOwner}
Developer: ${settings.developerName}
Prefix: ${settings.prefix}
Mode: ${currentMode}
Commands: ${totalCommands}
Uptime: ${uptime}
Memory: ${mem}
Time Zone: ${settings.timeZone}

${settings.footer}`;

    await conn.sendMessage(chatId, { text });
  }
};