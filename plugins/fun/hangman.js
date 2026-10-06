/**
 * NEXORA MD - Hangman
 * Word guessing game (per-chat)
 * Usage:
 *   .hangman        → start game
 *   .hangman <letter>
 *   .hangman stop
 */

const settings = require('../../settings');

const WORDS = [
  'banana', 'elephant', 'mountain', 'computer', 'sunshine',
  'waterfall', 'keyboard', 'chocolate', 'umbrella', 'notebook',
  'telephone', 'airplane', 'hamburger', 'crocodile', 'astronaut',
  'kangaroo', 'basketball', 'strawberry', 'universe', 'javascript'
];

const games = new Map(); // chatId -> game state

function renderWord(word, guessed) {
  return word.split('').map(l => guessed.has(l) ? l : '_').join(' ');
}

function lives(state) {
  const wrong = [...state.guessed].filter(l => !state.word.includes(l));
  return 6 - wrong.length;
}

function renderHangman(livesLeft) {
  const stages = [
    '  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========',
    '  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========',
    '  +---+\n  |   |\n      |\n      |\n      |\n      |\n========='
  ];
  return stages[Math.min(6 - livesLeft, 5)] || stages[0];
}

module.exports = {
  name: 'hangman',
  aliases: ['hm'],
  category: 'fun',
  description: 'Play hangman',
  usage: '.hangman | .hangman <letter> | .hangman stop',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const input = args.join(' ').trim().toLowerCase();

      // STOP
      if (input === 'stop') {
        if (!games.has(chatId)) {
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          return;
        }
        const state = games.get(chatId);
        games.delete(chatId);
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Game stopped. The word was: ${state.word}\n\n${settings.footer}`
        });
        return;
      }

      // GUESS
      if (games.has(chatId) && input.length === 1) {
        const state = games.get(chatId);
        const letter = input;

        if (!/^[a-z]$/.test(letter)) {
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          return;
        }

        if (state.guessed.has(letter)) {
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          await conn.sendMessage(chatId, { text: `Already guessed: ${letter}` });
          return;
        }

        state.guessed.add(letter);

        const livesLeft = lives(state);
        const displayed = renderWord(state.word, state.guessed);
        const wrong = [...state.guessed].filter(l => !state.word.includes(l));

        // Win?
        if (!displayed.includes('_')) {
          games.delete(chatId);
          await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
          await conn.sendMessage(chatId, {
            text: `YOU WON!\n\nThe word was: ${state.word}\n\n${settings.footer}`
          });
          return;
        }

        // Lose?
        if (livesLeft <= 0) {
          games.delete(chatId);
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          await conn.sendMessage(chatId, {
            text: `GAME OVER\n\nThe word was: ${state.word}\n\n${settings.footer}`
          });
          return;
        }

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `${renderHangman(livesLeft)}\n\n` +
            `Word: ${displayed}\n` +
            `Lives: ${livesLeft}\n` +
            `Wrong: ${wrong.join(', ') || 'none'}\n\n` +
            `${settings.footer}`
        });
        return;
      }

      // START NEW GAME
      if (!games.has(chatId)) {
        const word = WORDS[Math.floor(Math.random() * WORDS.length)];
        games.set(chatId, { word, guessed: new Set() });

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `HANGMAN STARTED\n\n` +
            `${renderHangman(6)}\n\n` +
            `Word: ${'_ '.repeat(word.length).trim()}\n` +
            `Lives: 6\n\n` +
            `Guess a letter: ${settings.prefix || '.'}hangman <letter>\n\n` +
            `${settings.footer}`
        });
        return;
      }

      await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
      await conn.sendMessage(chatId, {
        text: `Game in progress. Guess a single letter or type .hangman stop\n\n${settings.footer}`
      });

    } catch (error) {
      console.log('[HANGMAN] Error:', error.message);
    }
  }
};