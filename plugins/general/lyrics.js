/**
 * NEXORA MD - Lyrics
 * Two modes:
 *   .lyrics <artist> - <song>     → fetch real lyrics (auto-tries suggestions)
 *   .lyrics write <topic>          → AI generates full song
 */

const settings = require('../../settings');
const axios = require('axios');

// ─────────────────────────────────────────────
// FETCH MODE
// ─────────────────────────────────────────────
function parseArgs(input) {
  if (!input) return null;

  let parts = input.split(' - ');
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }

  parts = input.split('|');
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join('|').trim() };
  }

  return null;
}

async function fetchLyrics(artist, title) {
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
  const res = await axios.get(url, { timeout: 15000 });
  return res.data;
}

async function suggest(query, limit = 5) {
  const url = `https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`;
  const res = await axios.get(url, { timeout: 15000 });
  return (res.data?.data || []).slice(0, limit);
}

// ─────────────────────────────────────────────
// GENERATE MODE
// ─────────────────────────────────────────────
async function generateLyrics(prompt) {
  const res = await axios.post(
    'https://ai-song.ai/api/chat-openai',
    { lyrics: prompt },
    {
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'Accept': '*/*',
        'Origin': 'https://ai-song.ai',
        'Referer': 'https://ai-song.ai/',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36'
      },
      timeout: 60000
    }
  );
  return res.data;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function extractGeneratedText(data) {
  if (!data) return null;
  if (typeof data === 'string') return data;
  return (
    data.lyrics ||
    data.reply ||
    data.response ||
    data.message ||
    data.result ||
    data.text ||
    data.data?.lyrics ||
    data.data?.reply ||
    data.choices?.[0]?.message?.content ||
    null
  );
}

function chunkAndSend(text, maxLen = 4000) {
  if (!text) return [];
  if (text.length <= maxLen) return [text];
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLen) chunks.push(text.slice(i, i + maxLen));
  return chunks;
}

// ─────────────────────────────────────────────
// COMMAND
// ─────────────────────────────────────────────
module.exports = {
  name: 'lyrics',
  aliases: ['lyric', 'songlyrics'],
  category: 'general',
  description: 'Fetch or generate song lyrics',
  usage: '.lyrics <artist> - <title>  |  .lyrics write <topic>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const input = args.join(' ').trim();

      if (!input) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Lyrics\n\n` +
            `Fetch real lyrics:\n` +
            `  ${settings.prefix || '.'}lyrics <artist> - <title>\n` +
            `  ${settings.prefix || '.'}lyrics <artist> | <title>\n\n` +
            `Generate new lyrics (AI):\n` +
            `  ${settings.prefix || '.'}lyrics write <topic>\n\n` +
            `Examples:\n` +
            `  ${settings.prefix || '.'}lyrics Ed Sheeran - Shape of You\n` +
            `  ${settings.prefix || '.'}lyrics Otile Brown | Dusuma\n` +
            `  ${settings.prefix || '.'}lyrics write a love song about Nairobi\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // ═════════════════════════════════════════
      // MODE 1 — Generate new lyrics
      // ═════════════════════════════════════════
      if (/^write\s+/i.test(input)) {
        const rawPrompt = input.replace(/^write\s+/i, '').trim();

        if (!rawPrompt) {
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          await conn.sendMessage(chatId, {
            text: `Provide a topic.\n\n${settings.footer}`
          });
          return;
        }

        // Build a strong prompt that requests a FULL song
        const fullPrompt =
          `Write a complete full-length song about: ${rawPrompt}.\n\n` +
          `Structure it as:\n` +
          `[Verse 1] - 8 lines\n` +
          `[Pre-Chorus] - 4 lines\n` +
          `[Chorus] - 8 lines\n` +
          `[Verse 2] - 8 lines\n` +
          `[Chorus] - 8 lines\n` +
          `[Bridge] - 4 lines\n` +
          `[Chorus] - 8 lines\n` +
          `[Outro] - 2 lines\n\n` +
          `Make it emotionally rich, poetic, and complete. ` +
          `Do not stop early. Write the full song with all sections.`;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, { text: `Generating full song about "${rawPrompt}"...` });

        let data = null;
        try {
          data = await generateLyrics(fullPrompt);
        } catch (e) {
          console.log('[LYRICS] Generate failed:', e.message);
        }

        const text = extractGeneratedText(data);

        if (!text || typeof text !== 'string' || text.trim().length < 10) {
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          await conn.sendMessage(chatId, {
            text: `Could not generate lyrics.\n\n${settings.footer}`
          });
          return;
        }

        const header = `GENERATED LYRICS\n\nPrompt: ${rawPrompt}\n\n`;
        const footer = `\n\n${settings.footer}`;

        const chunks = chunkAndSend(text.trim(), 3500);

        if (chunks.length === 1) {
          await conn.sendMessage(chatId, { text: header + chunks[0] + footer });
        } else {
          await conn.sendMessage(chatId, { text: header + `${settings.footer}` });
          for (let i = 0; i < chunks.length; i++) {
            const label = `\n\n(Part ${i + 1}/${chunks.length})`;
            await conn.sendMessage(chatId, { text: chunks[i] + label });
            await new Promise(r => setTimeout(r, 500));
          }
        }

        console.log('[LYRICS] Generated lyrics for:', rawPrompt);
        return;
      }

      // ═════════════════════════════════════════
      // MODE 2 — Fetch real lyrics
      // ═════════════════════════════════════════
      const parsed = parseArgs(input);

      if (!parsed) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Could not parse.\n\n` +
            `Use:\n` +
            `  ${settings.prefix || '.'}lyrics <artist> - <title>\n` +
            `  ${settings.prefix || '.'}lyrics <artist> | <title>\n\n` +
            `${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `Searching lyrics for "${parsed.title}" by ${parsed.artist}...`
      });

      // ─────────────────────────────────────────
      // Try exact match first
      // ─────────────────────────────────────────
      let data = null;
      try {
        data = await fetchLyrics(parsed.artist, parsed.title);
      } catch (e) {
        console.log('[LYRICS] Direct fetch failed:', e.message);
      }

      // ─────────────────────────────────────────
      // If no lyrics → try suggestions automatically
      // ─────────────────────────────────────────
      if (!data || !data.lyrics) {
        try {
          const suggestions = await suggest(`${parsed.artist} ${parsed.title}`, 5);

          if (suggestions.length > 0) {
            // Try to fetch the first suggestion automatically
            for (const sugg of suggestions) {
              const suggArtist = sugg.artist?.name || parsed.artist;
              const suggTitle = sugg.title;

              if (!suggTitle) continue;

              try {
                const auto = await fetchLyrics(suggArtist, suggTitle);
                if (auto && auto.lyrics) {
                  data = auto;
                  console.log('[LYRICS] Auto-matched to:', suggArtist, '-', suggTitle);
                  break;
                }
              } catch (e) {
                // try next
              }
            }
          }

          // If still nothing after auto-try, show the suggestion list
          if (!data || !data.lyrics) {
            if (suggestions.length > 0) {
              let text = `No exact match found.\n\nDid you mean:\n\n`;
              suggestions.forEach((s, i) => {
                text += `${i + 1}. ${s.artist?.name || 'Unknown'} - ${s.title}\n`;
              });
              text += `\nTry: ${settings.prefix || '.'}lyrics <artist> - <title>\n\n`;
              text += `${settings.footer}`;

              await conn.sendMessage(chatId, { text });
              return;
            }

            await conn.sendMessage(chatId, {
              text: `No lyrics found for "${parsed.title}" by ${parsed.artist}.\n\n${settings.footer}`
            });
            return;
          }
        } catch (e) {
          console.log('[LYRICS] Suggest failed:', e.message);
          await conn.sendMessage(chatId, {
            text: `No lyrics found.\n\n${settings.footer}`
          });
          return;
        }
      }

      // ─────────────────────────────────────────
      // Send lyrics
      // ─────────────────────────────────────────
      let lyrics = (data.lyrics || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

      const header = `LYRICS\n\n${data.artist?.name || parsed.artist} - ${data.title || parsed.title}\n\n`;
      const fullText = header + lyrics + `\n\n${settings.footer}`;
      const chunks = chunkAndSend(fullText, 4000);

      for (const chunk of chunks) {
        await conn.sendMessage(chatId, { text: chunk });
        if (chunks.length > 1) await new Promise(r => setTimeout(r, 500));
      }

      console.log('[LYRICS] Sent:', data.title || parsed.title);

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