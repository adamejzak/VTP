import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const SYMBOL_LABELS = {
  X: '❌',
  O: '⭕'
};

const EMPTY_LABEL = '⬜';

function resolveCellStyle(game, cellValue, position) {
  if (Array.isArray(game.winningCombo) && game.winningCombo.includes(position)) {
    return ButtonStyle.Success;
  }

  if (cellValue === 'X') {
    return ButtonStyle.Danger;
  }

  if (cellValue === 'O') {
    return ButtonStyle.Primary;
  }

  return ButtonStyle.Secondary;
}

function resolveCellLabel(cellValue) {
  if (!cellValue) {
    return EMPTY_LABEL;
  }

  return SYMBOL_LABELS[cellValue] ?? cellValue;
}

function resolveStatusDescription(game) {
  const lines = [
    '**Gracze**',
    `❌ <@${game.playerX}>`,
    `⭕ <@${game.playerO}>`,
    ''
  ];

  if (game.status === 'active') {
    const currentSymbol = game.currentPlayer === game.playerX ? '❌' : '⭕';
    lines.push(`Tura: ${currentSymbol} <@${game.currentPlayer}>`);
  } else if (game.status === 'completed') {
    if (game.winner) {
      const winnerSymbol = game.winner === game.playerX ? '❌' : '⭕';
      lines.push(`Zwycięzca: ${winnerSymbol} <@${game.winner}> 🎉`);
    } else {
      lines.push('Remis! 🤝');
    }
  } else if (game.status === 'cancelled') {
    if (game.cancelReason === 'timeout') {
      lines.push('Gra została anulowana – przekroczono limit czasu ⏱️');
    } else {
      lines.push('Gra została anulowana.');
    }
  }

  return lines.join('\n');
}

export function buildTicTacToeEmbed(game) {
  return new EmbedBuilder()
    .setColor(game.status === 'completed' ? '#57F287' : '#5865F2')
    .setTitle('Kółko i Krzyżyk')
    .setDescription(resolveStatusDescription(game))
    .setTimestamp();
}

export function buildTicTacToeComponents(game) {
  const rows = [];

  for (let row = 0; row < 3; row += 1) {
    const actionRow = new ActionRowBuilder();

    for (let column = 0; column < 3; column += 1) {
      const position = row * 3 + column;
      const cellValue = game.board[position];

      const button = new ButtonBuilder()
        .setCustomId(`${game.id}_cell_${position}`)
        .setLabel(resolveCellLabel(cellValue))
        .setStyle(resolveCellStyle(game, cellValue, position))
        .setDisabled(Boolean(cellValue) || game.status !== 'active');

      actionRow.addComponents(button);
    }

    rows.push(actionRow);
  }

  return rows;
}


