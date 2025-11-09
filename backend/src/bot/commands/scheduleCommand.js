import { SlashCommandBuilder } from 'discord.js';
import logger from '../../config/logger.js';
import { buildScheduleMenu } from '../utils/scheduleUi.js';

export const data = new SlashCommandBuilder()
  .setName('grafik')
  .setDescription('Wyświetl swój grafik z ostatnich miesięcy');

export async function execute(interaction, { prisma }) {
  const userDiscordId = interaction.user.id;

  try {
    const employee = await prisma.user.findFirst({
      where: { discordId: userDiscordId }
    });

    if (!employee) {
      return interaction.reply({
        content: 'Nie udało się odnaleźć Twojego konta pracownika. Skontaktuj się z administratorem.',
        ephemeral: true
      });
    }

    const menu = await buildScheduleMenu(prisma, employee.id);

    return interaction.reply({
      embeds: [menu.embed],
      components: menu.components,
      ephemeral: true
    });
  } catch (error) {
    logger.error(`Schedule command error: ${error.message}`, { stack: error.stack });
    return interaction.reply({
      content: 'Wystąpił błąd podczas przygotowywania listy grafików.',
      ephemeral: true
    });
  }
}


