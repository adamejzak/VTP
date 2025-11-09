import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js';
import { startRockPaperScissorsGame } from './rockPaperScissorsCommand.js';

export const data = new ContextMenuCommandBuilder()
  .setName('Zagraj w Papier Kamien')
  .setType(ApplicationCommandType.User);

export async function execute(interaction) {
  if (!interaction.isUserContextMenuCommand()) {
    return;
  }

  const challenger = interaction.user;
  const opponent = interaction.targetUser;

  return startRockPaperScissorsGame(interaction, challenger, opponent);
}



