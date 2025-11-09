import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import logger from '../../config/logger.js';
import { rpsState } from '../../utils/rpsState.js';

export const data = new SlashCommandBuilder()
  .setName('pkn')
  .setDescription('Papier-Kamień-Nożyce: wyzwij przeciwnika')
  .addUserOption(option =>
    option
      .setName('przeciwnik')
      .setDescription('Użytkownik do gry')
      .setRequired(true)
  );

export async function execute(interaction) {
  const challenger = interaction.user;
  const opponent = interaction.options.getUser('przeciwnik');
  return startRockPaperScissorsGame(interaction, challenger, opponent);
}

export async function startRockPaperScissorsGame(interaction, challenger, opponent) {
  if (!opponent || opponent.bot || opponent.id === challenger.id) {
    return interaction.reply({
      content: 'Wybierz innego, prawdziwego użytkownika.',
      ephemeral: true
    });
  }

  if (rpsState.hasUserActive(challenger.id) || rpsState.hasUserActive(opponent.id)) {
    return interaction.reply({
      content: 'Jedna z osób już gra. Spróbuj później.',
      ephemeral: true
    });
  }

  const gameId = `rps_${Date.now()}_${challenger.id}_${opponent.id}`;
  rpsState.addPair(challenger.id, opponent.id, gameId);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${gameId}_kamien`)
      .setLabel('🧱 Kamień')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${gameId}_papier`)
      .setLabel('📄 Papier')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${gameId}_nozyce`)
      .setLabel('✂️ Nożyce')
      .setStyle(ButtonStyle.Primary)
  );

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('Papier-Kamień-Nożyce')
    .setDescription(
      `Wyzwanie: <@${challenger.id}> vs <@${opponent.id}>\n` +
      `Status: czekam na ruchy\n` +
      `Wybierz swój ruch klikając przycisk.`
    )
    .setTimestamp();

  try {
    const reply = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    setTimeout(async () => {
      try {
        if (!rpsState.getState(gameId)) {
          return;
        }
        rpsState.removeByGame(gameId);

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`${gameId}_kamien`)
            .setLabel('🧱 Kamień')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`${gameId}_papier`)
            .setLabel('📄 Papier')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`${gameId}_nozyce`)
            .setLabel('✂️ Nożyce')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
        );

        const timeoutEmbed = EmbedBuilder.from(embed)
          .setDescription(`${embed.data.description}\n\n⏱️ Gra została przerwana – czas minął`);

        await reply.edit({
          embeds: [timeoutEmbed],
          components: [disabledRow]
        });
      } catch (error) {
        logger.error(`Failed to cancel RPS game ${gameId}: ${error.message}`);
      }
    }, 60 * 1000);

    return reply;
  } catch (error) {
    logger.error(`RPS command error: ${error.message}`, { stack: error.stack });
    rpsState.removeByGame(gameId);
    throw error;
  }
}


