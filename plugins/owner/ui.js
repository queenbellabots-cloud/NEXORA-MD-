/**
 * NEXORA MD - Menu UI Theme Command
 * Owner-only. Switch between 10 menu themes.
 */

const settings = require('../../settings');
const ui = require('../../lib/ui');

module.exports = {
  name: 'ui',
  aliases: ['theme', 'menustyle'],
  category: 'owner',
  description: 'Switch menu theme',
  usage: '.ui <number>',
  ownerOnly: false,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const input = (args[0] || '').trim();
      const current = ui.getTheme();

      // ─────────────────────────────────────────
      // SWITCH
      // ─────────────────────────────────────────
      if (input) {
        const n = parseInt(input, 10);
        const info = ui.getThemeInfo(n);

        if (!info || !ui.THEMES[n]) {
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          await conn.sendMessage(chatId, {
            text:
              `Invalid theme number: ${input}\n\n` +
              `Available themes:\n` +
              ui.listThemes().map(t => `  ${t.n}. ${t.name}${t.premium ? ' [PREMIUM]' : ''}`).join('\n') +
              `\n\n${settings.footer}`
          });
          return;
        }

        const ok = ui.setTheme(n);
        if (!ok) {
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          return;
        }

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Menu theme switched.\n\n` +
            `Theme: ${n} - ${info.name}${info.premium ? ' [PREMIUM]' : ''}\n\n` +
            `Send ${settings.prefix || '.'}menu to see the new look.\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // STATUS
      // ─────────────────────────────────────────
      const cur = ui.getThemeInfo(current);
      const list = ui.listThemes();

      let text = `MENU THEMES\n\n`;
      text += `Current: ${current} - ${cur.name}${cur.premium ? ' [PREMIUM]' : ''}\n\n`;
      text += `Available:\n`;

      list.forEach(t => {
        const marker = t.n === current ? ' (current)' : '';
        const premiumTag = t.premium ? ' [PREMIUM]' : '';
        text += `  ${t.n}. ${t.name}${premiumTag}${marker}\n`;
      });

      text += `\nUsage: ${settings.prefix || '.'}ui <number>\n\n`;
      text += `${settings.footer}`;

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text });
    } catch (error) {
      console.log('[UI] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
    }
  }
};