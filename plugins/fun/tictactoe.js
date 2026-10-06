/**
 * NEXORA MD - Tic Tac Toe
 * Play against another user (per-chat)
 * Usage:
 *   .tictactoe @user    → challenge someone
 *   .ttt <position 1-9> → make a move
 *   .tictactoe stop     → end game
 */

const settings = require('../../settings');

const games = new Map(); // chatId -> { board, x, o, turn }

function cleanNum(s) {
  return String(s || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function renderBoard(board) {
  const cells = board.map((c, i) => c || (i + 1));
  return (
    `${cells[0]} | ${cells[1]} | ${cells[2]}\n` +
    `---------\n` +
    `${cells[3]} | ${cells[4]} | ${cells[5]}\n` +
    `---------\n` +
    `${cells[6]} | ${cells[7]} | ${cells[8]}`
  );
}

function checkWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

module.exports = {
  name: 'tictactoe',
  aliases: ['ttt'],
  category: 'fun',
  description: 'Play Tic Tac Toe',
  usage: '.tictactoe @user | .ttt <1-9>',
  react: '✅',

  async execute(conn, mek, args, chatId, isOwner) {
    try {
      const input = args.join(' ').trim().toLowerCase();
      const sender = mek.key.participant || mek.key.remoteJid;
      const senderNum = cleanNum(sender);

      // STOP
      if (input === 'stop') {
        if (!games.has(chatId)) {
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          return;
        }
        games.delete(chatId);
        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `Game stopped.\n\n${settings.footer}`
        });
        return;
      }

      // MOVE
      if (games.has(chatId) && /^[1-9]$/.test(input)) {
        const state = games.get(chatId);
        const pos = parseInt(input) - 1;

        if (state.turn !== senderNum) {
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          await conn.sendMessage(chatId, {
            text: `Not your turn.\n\n${settings.footer}`
          });
          return;
        }

        if (state.board[pos]) {
          await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
          return;
        }

        state.board[pos] = state.turn === state.x ? 'X' : 'O';

        const winner = checkWinner(state.board);
        if (winner) {
          games.delete(chatId);
          await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
          await conn.sendMessage(chatId, {
            text: `${renderBoard(state.board)}\n\n${winner === 'X' ? `@${state.x}` : `@${state.o}`} wins!\n\n${settings.footer}`,
            mentions: [state.x + '@s.whatsapp.net', state.o + '@s.whatsapp.net']
          });
          return;
        }

        if (state.board.every(c => c)) {
          games.delete(chatId);
          await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
          await conn.sendMessage(chatId, {
            text: `${renderBoard(state.board)}\n\nIt's a draw!\n\n${settings.footer}`
          });
          return;
        }

        state.turn = state.turn === state.x ? state.o : state.x;

        await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `${renderBoard(state.board)}\n\n` +
            `@${state.turn}'s turn\n\n` +
            `${settings.footer}`,
          mentions: [state.turn + '@s.whatsapp.net']
        });
        return;
      }

      // START NEW GAME
      const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      if (mentioned.length === 0) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text:
            `Tic Tac Toe\n\n` +
            `Challenge someone: ${settings.prefix || '.'}tictactoe @user\n` +
            `Make a move: ${settings.prefix || '.'}ttt <1-9>\n` +
            `Stop: ${settings.prefix || '.'}tictactoe stop\n\n` +
            `${settings.footer}`
        });
        return;
      }

      if (games.has(chatId)) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        return;
      }

      const opponent = mentioned[0];
      const opponentNum = cleanNum(opponent);

      if (opponentNum === senderNum) {
        await conn.sendMessage(chatId, { react: { text: '❌', key: mek.key } });
        await conn.sendMessage(chatId, {
          text: `You can't play against yourself.\n\n${settings.footer}`
        });
        return;
      }

      games.set(chatId, {
        board: Array(9).fill(null),
        x: senderNum,
        o: opponentNum,
        turn: senderNum
      });

      await conn.sendMessage(chatId, { react: { text: '✅', key: mek.key } });
      await conn.sendMessage(chatId, {
        text:
          `TIC TAC TOE\n\n` +
          `@${senderNum} (X) vs @${opponentNum} (O)\n\n` +
          `${renderBoard(Array(9).fill(null))}\n\n` +
          `@${senderNum} starts. Use ${settings.prefix || '.'}ttt <1-9>\n\n` +
          `${settings.footer}`,
        mentions: [sender, opponent]
      });

    } catch (error) {
      console.log('[TTT] Error:', error.message);
    }
  }
};