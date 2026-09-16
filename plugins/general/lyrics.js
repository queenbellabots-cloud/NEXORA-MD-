/**
 * NEXORA MD - Lyrics
 * Fetch song lyrics via lyrics.ovh (free, no API key)
 * Usage:
 *   .lyrics <artist> - <title>
 *   .lyrics <artist> | <title>
 *   .lyrics <artist> - <title> -suggest   (search suggestions first)
 */

const settings = require('../../settings');
const axios = require('axios');

const API_BASE = 'https://api.lyrics.ovh';

function parseArgs(input) {
  if (!input) return null;

  // Try "artist - title"
  let parts = input.split(' - ');
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }

  // Try "artist | title"
  parts = input.split('|');
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join('|').trim() };
  }

  return null;
}

async function fetchLyrics(artist, title) {
  const url = `${API_BASE}/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
  const res = await axios.get(url, { timeout: 15000 });
  return res.data;
}

async function suggest(query, limit = 5) {
  const url = `${API_BASE}/suggest/${encodeURIComponent(query)}`;
  const res = await axios.get(url, { timeout: 15000 });
  return (res.data?.data || []).slice(0, limit);
}

module.exports = {
  name: 'lyrics',
  aliases: ['lyric', 'songlyrics'],
  category: 'general',
  description: 'Get song lyrics',
  usage: '.lyrics <artist> - <title>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const input = args.join(' ').trim();

      if (!input) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Get song lyrics\n\n` +
            `Usage:\n` +
            `  ${settings.prefix || '.'}lyrics <artist> - <title>\n` +
            `  ${settings.prefix || '.'}lyrics <artist> | <title>\n\n` +
            `Examples:\n` +
            `  ${settings.prefix || '.'}lyrics Ed Sheeran - Shape of You\n` +
            `  ${settings.prefix || '.'}lyrics Sauti Sol - Suzanna\n\n` +
            `${settings.footer}`
        });
        return;
      }

      const parsed = parseArgs(input);

      if (!parsed) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Could not parse input.\n\n` +
            `Use this format:\n` +
            `  ${settings.prefix || '.'}lyrics <artist> - <title>\n\n` +
            `Example:\n` +
            `  ${settings.prefix || '.'}lyrics Ed Sheeran - Shape of You\n\n` +
            `${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `Searching lyrics for "${parsed.title}" by ${parsed.artist}...`
      });

      let data = null;
      try {
        data = await fetchLyrics(parsed.artist, parsed.title);
      } catch (e) {
        console.log('[LYRICS] Fetch failed:', e.message);
      }

      // If exact match fails, try suggestions
      if (!data || !data.lyrics) {
        try {
          const suggestions = await suggest(`${parsed.artist} ${parsed.title}`, 5);

          if (suggestions.length > 0) {
            let text = `No exact match found.\n\nDid you mean:\n\n`;
            suggestions.forEach((s, i) => {
              text += `${i + 1}. ${s.artist?.name || 'Unknown'} - ${s.title}\n`;
            });
            text += `\nUsage: ${settings.prefix || '.'}lyrics <artist> - <title>\n\n`;
            text += `${settings.footer}`;

            await conn.sendMessage(chatId, { text });
            return;
          }
        } catch (e) {
          console.log('[LYRICS] Suggest failed:', e.message);
        }

        await conn.sendMessage(chatId, {
          text: `No lyrics found for "${parsed.title}" by ${parsed.artist}.\n\n${settings.footer}`
        });
        return;
      }

      // Clean up lyrics text
      let lyrics = data.lyrics || '';
      lyrics = lyrics.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

      // WhatsApp message limit — split if too long
      const MAX_LEN = 4000;

      const header = `LYRICS\n\n${data.artist?.name || parsed.artist} - ${data.title || parsed.title}\n\n`;

      if ((header + lyrics).length <= MAX_LEN) {
        await conn.sendMessage(chatId, {
          text: header + lyrics + `\n\n${settings.footer}`
        });
      } else {
        // Send header first
        await conn.sendMessage(chatId, {
          text: header + `\n${settings.footer}`
        });

        // Split lyrics into chunks
        const chunks = [];
        for (let i = 0; i < lyrics.length; i += MAX_LEN) {
          chunks.push(lyrics.slice(i, i + MAX_LEN));
        }

        for (let i = 0; i < chunks.length; i++) {
          const partLabel = chunks.length > 1 ? `\n\n(Part ${i + 1}/${chunks.length})` : '';
          await conn.sendMessage(chatId, {
            text: chunks[i] + partLabel
          });
          await new Promise(r => setTimeout(r, 500));
        }
      }

    } catch (error) {
      console.log('[LYRICS] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      try {
        await conn.sendMessage(chatId, {
          text: `Error: ${error.message}\n\n${settings.footer}`
        });
      } catch (e) {}
    }
  }
};