/**
 * NEXORA MD - Play (YouTube Audio)
 * Search + download audio via azbry.com API
 * Usage:
 *   .play <song name>
 *   .play (reply to a text message with a song title)
 */

const settings = require('../../settings');
const axios = require('axios');

module.exports = {
  name: 'play',
  aliases: ['song', 'music', 'audio'],
  category: 'general',
  description: 'Search and play a song from YouTube',
  usage: '.play <song name or title>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      // ─────────────────────────────────────────
      // 1. Get query from args or replied message
      // ─────────────────────────────────────────
      let query = args.join(' ').trim();

      if (!query) {
        const contextInfo = mek.message?.extendedTextMessage?.contextInfo;
        const quoted = contextInfo?.quotedMessage;

        if (quoted) {
          const text =
            quoted.conversation ||
            quoted.extendedTextMessage?.text ||
            quoted.imageMessage?.caption ||
            quoted.videoMessage?.caption ||
            '';

          if (text) {
            query = text.trim();
          }
        }
      }

      if (!query) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Play a song\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}play <song name>\n` +
            `  Reply to a text with ${settings.prefix || '.'}play\n\n` +
            `Example:\n` +
            `  ${settings.prefix || '.'}play Sauti Sol Suzanna\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 2. React and notify
      // ─────────────────────────────────────────
      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, { text: `Searching for "${query}"...` });

      // ─────────────────────────────────────────
      // 3. Call azbry API
      // ─────────────────────────────────────────
      let data = null;
      try {
        const res = await axios.get(
          `https://api.azbry.com/api/download/ytplay2?q=${encodeURIComponent(query)}`,
          { timeout: 30000 }
        );
        data = res.data;
      } catch (apiErr) {
        console.log('[PLAY] API error:', apiErr.message);
      }

      if (!data || !data.status || !data.result) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `No results found for "${query}".\n\n${settings.footer}`
        });
        return;
      }

      const result = data.result;

      if (!result.download) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Download link not available.\n\n${settings.footer}`
        });
        return;
      }

      // ─────────────────────────────────────────
      // 4. Send title + audio
      // ─────────────────────────────────────────
      try {
        await conn.sendMessage(chatId, {
          text: result.title || query
        }, { quoted: mek });

        await conn.sendMessage(chatId, {
          audio: { url: result.download },
          mimetype: 'audio/mpeg',
          fileName: `${(result.title || query).slice(0, 60)}.mp3`
        }, { quoted: mek });

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      } catch (sendErr) {
        console.log('[PLAY] Send failed:', sendErr.message);
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Failed to send audio: ${sendErr.message}\n\n${settings.footer}`
        });
      }

    } catch (error) {
      console.log('[PLAY] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};