module.exports = {
  name: 'debug',
  category: 'general',
  description: 'Debug command loader',
  ownerOnly: true,
  async execute(conn, mek, args, chatId, isOwner) {
    const commands = global.commands;
    let report = 'DEBUG REPORT\n\n';

    report += 'global.commands type: ' + typeof commands + '\n';
    report += 'is Map: ' + (commands instanceof Map) + '\n';
    report += 'size: ' + (commands?.size || 0) + '\n\n';

    if (commands && commands.size > 0) {
      report += 'LOADED COMMANDS:\n';
      const seen = new Set();
      commands.forEach((cmd, key) => {
        if (!seen.has(cmd.name)) {
          seen.add(cmd.name);
          report += '- ' + cmd.name + ' (' + (cmd.category || 'none') + ')\n';
        }
      });
    }

    await conn.sendMessage(chatId, { text: report });
  }
};