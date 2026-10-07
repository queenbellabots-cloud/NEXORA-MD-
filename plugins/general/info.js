const settings = require('../../settings');
const { formatTime, formatBytes } = require('../../lib/myfunc');
const startTime = Date.now();

const BOT_IMAGE = 'https://yourimageshare.com/ib/nky6GDc1JX.png';

module.exports = {
  name: 'info',
  aliases: ['botinfo', 'status'],
  category: 'general',
  description: 'Show bot info',
  usage: '.info',
  react: '✅',
  async execute(conn, mek, args, chatId, isOwner) {
    try {
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      const uptime = formatTime(Date.now() - startTime);
      const mem = formatBytes(process.memoryUsage().rss);
      const totalCommands = global.commands ? global.commands.size : 0;
      const currentMode = global.botMode ? global.botMode.toUpperCase() : 'PUBLIC';

      const caption = `
╔══════════════════════════╗
║   ✦  𝐍 𝐄 𝐗 𝐎 𝐑 𝐀  ✦   
╚══════════════════════════╝

┏━━━〔 ⚡ SYSTEM INFO 〕━━━┓
┃
┃ ╭─❖ 👤 *Owner*
┃ │➤ ${settings.botOwner}
┃ ╰──────────────
┃
┃ ╭─❖ 🛠️ *Developer*
┃ │➤ ${settings.developerName}
┃ ╰──────────────
┃
┃ ╭─❖ 🔰 *Prefix*
┃ │➤ ${settings.prefix}
┃ ╰──────────────
┃
┃ ╭─❖ 🌐 *Mode*
┃ │➤ ${currentMode}
┃ ╰──────────────
┃
┃ ╭─❖ 📦 *Commands*
┃ │➤ ${totalCommands}
┃ ╰──────────────
┃
┃ ╭─❖ ⏱️ *Uptime*
┃ │➤ ${uptime}
┃ ╰──────────────
┃
┃ ╭─❖ 💾 *Memory*
┃ │➤ ${mem}
┃ ╰──────────────
┃
┃ ╭─❖ 🕐 *Time Zone*
┃ │➤ ${settings.timeZone}
┃ ╰──────────────
┃
┗━━━━━━━━━━━━━━━━━━━━━━┛

      _${settings.footer}_ 
`;

      try {
        await conn.sendMessage(chatId, {
          image: { url: BOT_IMAGE },
          caption,
          mimetype: 'image/png'
        });
      } catch (imgErr) {
        console.log('⚠️ Image fetch failed, sending text only:', imgErr.message);
        await conn.sendMessage(chatId, { text: caption });
      }

    } catch (err) {
      console.error('❌ INFO COMMAND ERROR:', err);
      await conn.sendMessage(chatId, {
        text: `⚠️ *Info error:*\n${err.message}`
      });
    }
  }
};