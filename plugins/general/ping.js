module.exports = {
  name: 'ping',
  aliases: ['p'],
  category: 'general',
  description: 'Check bot latency',
  usage: '.ping',
  react: '✅',
  async execute(conn, mek, args, chatId, isOwner) {
    const start = Date.now();
    await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
    const latency = Date.now() - start;
    await conn.sendMessage(chatId, {
      text: `Pong\nLatency: ${latency}ms`
    });
  }
};