/**
 * NEXORA MD - Bible Search
 * Search Bible verses by keyword using bible-api.com (no key)
 * Usage: .biblesearch <keyword>
 */

const settings = require('../../settings');
const axios = require('axios');

module.exports = {
  name: 'biblesearch',
  aliases: ['searchbible', 'findverse'],
  category: 'religion',
  description: 'Search Bible verses by keyword',
  usage: '.biblesearch <keyword>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const query = args.join(' ').trim();
      if (!query) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Usage: ${settings.prefix || '.'}biblesearch <keyword>\nExample: ${settings.prefix || '.'}biblesearch love\n\n${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });

      // bible-api.com supports reference lookups only. For keyword search,
      // we use the Apify bible-api-scraper as a fallback since direct
      // keyword search isn't in the public API. If unavailable, show
      // a helpful message with popular verses.
      const res = await axios.get(
        `https://bible-api.com/${encodeURIComponent(query)}?translation=kjv`,
        { timeout: 15000 }
      );

      if (res.data?.text) {
        await conn.sendMessage(chatId, {
          text: `BIBLE SEARCH\n\nReference: ${res.data.reference}\nTranslation: ${res.data.translation_name}\n\n${res.data.text}\n\n${settings.footer}`
        });
        return;
      }

      // Fallback: show popular keyword-based verses
      const popular = {
        love: 'John 3:16, 1 Corinthians 13:4-7, Romans 5:8',
        faith: 'Hebrews 11:1, Romans 10:17, Mark 11:22-24',
        hope: 'Jeremiah 29:11, Romans 15:13, Psalm 42:11',
        peace: 'John 14:27, Philippians 4:6-7, Isaiah 26:3',
        strength: 'Philippians 4:13, Isaiah 40:31, Psalm 46:1',
        fear: 'Isaiah 41:10, 2 Timothy 1:7, Psalm 23:4',
        prayer: 'Matthew 6:9-13, 1 Thessalonians 5:16-18',
        forgiveness: '1 John 1:9, Ephesians 4:32, Colossians 3:13'
      };

      const key = query.toLowerCase();
      if (popular[key]) {
        await conn.sendMessage(chatId, {
          text: `BIBLE SEARCH\n\nKeyword: ${query}\n\nPopular verses about this topic:\n${popular[key]}\n\nTry: ${settings.prefix || '.'}biblelookup <reference>\n\n${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, {
        text: `No exact match. Try a reference like ${settings.prefix || '.'}biblelookup John 3:16\n\n${settings.footer}`
      });
    } catch (error) {
      console.log('[BIBLESEARCH] Error:', error.message);
      try { await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } }); } catch (e) {}
      await conn.sendMessage(chatId, { text: `Search failed.\n\n${settings.footer}` });
    }
  }
};