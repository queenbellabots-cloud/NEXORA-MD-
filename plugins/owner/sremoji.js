/**
 * NEXORA MD - Set Status Reaction Emojis
 * Owner-only. Controls which emojis the bot uses for status reactions.
 */

const fs = require('fs');
const settings = require('../../settings');

const dataPath = './data/status.json';

function getDefaultEmojis() {
  if (Array.isArray(settings.statusReactionEmojis) && settings.statusReactionEmojis.length > 0) {
    return settings.statusReactionEmojis.slice();
  }
  return [
    '🔥', '❤️', '😍', '👑', '✨', '🌟', '💯', '🎉', '💪', '👏',
    '🙌', '🤩', '😎', '💥', '⭐', '🌈', '🎊', '🎈', '💖', '💗',
    '👍', '🙏', '✌️', '🤝', '😊', '😃', '😂', '🥳', '🤗', '🤔'
  ];
}

if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });

function readStore() {
  try {
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      return {
        view: data.view !== false,
        react: data.react !== false,
        emojis: Array.isArray(data.emojis) && data.emojis.length > 0
          ? data.emojis
          : getDefaultEmojis()
      };
    }
  } catch (e) {
    console.log('[SREMOJI] Read failed:', e.message);
  }
  return { view: true, react: true, emojis: getDefaultEmojis() };
}

function writeStore(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('[SREMOJI] Write failed:', e.message);
  }
}

module.exports = {
  name: 'sremoji',
  aliases: ['statusreactemoji', 'statusemojis', 'sre'],
  category: 'owner',
  description: 'Set emojis used for auto-reacting to statuses',
  usage: '.sremoji emoji1,emoji2,emoji3',
  ownerOnly: true,
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      if (!isOwner) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const store = readStore();
      const input = args.join(' ').trim();
      const lower = input.toLowerCase();

      if (lower === 'off') {
        store.react = false;
        writeStore(store);
        if (global.autoStatusFlags) global.autoStatusFlags.react = false;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Auto-react to statuses: DISABLED\n\n${settings.footer}`
        });
        return;
      }

      if (lower === 'on') {
        store.react = true;
        writeStore(store);
        if (global.autoStatusFlags) global.autoStatusFlags.react = true;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Auto-react to statuses: ENABLED\n\n${settings.footer}`
        });
        return;
      }

      if (lower === 'reset') {
        store.emojis = getDefaultEmojis();
        writeStore(store);
        if (global.autoStatusFlags) global.autoStatusFlags.react = true;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Reaction emojis reset to defaults.\n\n` +
            `Count: ${store.emojis.length}\n\n` +
            `${settings.footer}`
        });
        return;
      }

      if (input) {
        const rawParts = input.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
        const emojiRegex = /^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]+$/u;
        const valid = rawParts.filter(e => emojiRegex.test(e));

        if (valid.length === 0) {
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          await conn.sendMessage(chatId, {
            text:
              `No valid emojis detected.\n\n` +
              `Example:\n` +
              `  ${settings.prefix || '.'}sremoji 😀,❤️,🔥,👑\n\n` +
              `${settings.footer}`
          });
          return;
        }

        store.emojis = valid;
        store.react = true;
        writeStore(store);
        if (global.autoStatusFlags) global.autoStatusFlags.react = true;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Status reaction emojis updated.\n\n` +
            `Count: ${valid.length}\n` +
            `List: ${valid.join(' ')}\n\n` +
            `Auto-react: ENABLED\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const reactStatus = store.react ? 'ENABLED' : 'DISABLED';
      const emojiCount = store.emojis.length;
      const preview = store.emojis.slice(0, 30).join(' ');
      const extra = emojiCount > 30 ? ` ... (+${emojiCount - 30} more)` : '';

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `STATUS REACTION SETTINGS\n\n` +
          `Auto-react: ${reactStatus}\n` +
          `Emoji count: ${emojiCount}\n` +
          `List: ${preview}${extra}\n\n` +
          `Commands:\n` +
          `  ${settings.prefix || '.'}sremoji 😀,❤️,🔥   - set list\n` +
          `  ${settings.prefix || '.'}sremoji on          - enable\n` +
          `  ${settings.prefix || '.'}sremoji off         - disable\n` +
          `  ${settings.prefix || '.'}sremoji reset       - restore defaults\n\n` +
          `${settings.footer}`
      });
    } catch (error) {
      console.log('[SREMOJI] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};