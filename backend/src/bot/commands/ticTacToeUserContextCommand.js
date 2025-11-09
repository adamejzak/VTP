import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js';
import { startTicTacToeGame } from './ticTacToeCommand.js';

export const data = new ContextMenuCommandBuilder()
  .setName('Zagraj w Kolko Krzyzyk')
  .setType(ApplicationCommandType.User);

export async function execute(interaction) {
  if (!interaction.isUserContextMenuCommand()) {
    return;
  }

  const challenger = interaction.user;
  const opponent = interaction.targetUser;

  return startTicTacToeGame(interaction, challenger, opponent);
}









