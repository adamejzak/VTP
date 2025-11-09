import { SlashCommandBuilder } from 'discord.js';
import logger from '../../config/logger.js';
import { ticTacToeState } from '../../utils/ticTacToeState.js';
import { buildTicTacToeEmbed, buildTicTacToeComponents } from '../utils/ticTacToeUi.js';

const GAME_TIMEOUT_MS = 5 * 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName('kolkokrzyzyk')
  .setDescription('Rozpocznij grę w kółko i krzyżyk z innym użytkownikiem.')
  .addUserOption(option =>
    option
      .setName('przeciwnik')
      .setDescription('Wybierz przeciwnika do gry')
      .setRequired(true)
  );

export async function execute(interaction) {
  const challenger = interaction.user;
  const opponent = interaction.options.getUser('przeciwnik');
  return startTicTacToeGame(interaction, challenger, opponent);
}

export async function startTicTacToeGame(interaction, challenger, opponent) {
  if (!opponent || opponent.bot || opponent.id === challenger.id) {
    return interaction.reply({
      content: 'Musisz wybrać innego, prawdziwego użytkownika.',
      ephemeral: true
    });
  }

  if (ticTacToeState.hasUserActive(challenger.id) || ticTacToeState.hasUserActive(opponent.id)) {
    return interaction.reply({
      content: 'Jedna z osób ma już aktywną grę. Spróbuj ponownie później.',
      ephemeral: true
    });
  }

  const gameId = `ttt_${Date.now()}_${challenger.id}_${opponent.id}`;
  const challengerStarts = Math.random() < 0.5;
  const playerX = challengerStarts ? challenger.id : opponent.id;
  const playerO = challengerStarts ? opponent.id : challenger.id;

  const game = ticTacToeState.createGame(gameId, playerX, playerO);
  const embed = buildTicTacToeEmbed(game);
  const components = buildTicTacToeComponents(game);

  try {
    const reply = await interaction.reply({
      content: `<@${challenger.id}> zaprosił <@${opponent.id}> do gry w kółko i krzyżyk!`,
      embeds: [embed],
      components,
      fetchReply: true
    });

    const timeoutRef = setTimeout(async () => {
      try {
        const expiredGame = ticTacToeState.expireGame(gameId, 'timeout');
        if (!expiredGame) {
          return;
        }

        const timeoutEmbed = buildTicTacToeEmbed(expiredGame);
        const timeoutComponents = buildTicTacToeComponents(expiredGame);

        await reply.edit({
          embeds: [timeoutEmbed],
          components: timeoutComponents
        });
      } catch (error) {
        logger.error(`Failed to expire Tic Tac Toe game ${gameId}: ${error.message}`);
      } finally {
        ticTacToeState.finishGame(gameId);
      }
    }, GAME_TIMEOUT_MS);

    ticTacToeState.setTimeoutRef(gameId, timeoutRef);
    return reply;
  } catch (error) {
    logger.error(`Tic Tac Toe command error: ${error.message}`, { stack: error.stack });
    ticTacToeState.finishGame(gameId);
    throw error;
  }
}


