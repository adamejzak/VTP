import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import logger from '../../config/logger.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Sprawdź czas odpowiedzi bota');

export async function execute(interaction) {
  try {
    const startTime = Date.now();
    
    await interaction.deferReply();
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    const wsPing = interaction.client.ws.ping;
    
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🏓 Pong!')
      .addFields(
        {
          name: '⚡ Czas odpowiedzi',
          value: `\`${responseTime}ms\``,
          inline: true
        },
        {
          name: '🌐 Ping WebSocket',
          value: `\`${wsPing}ms\``,
          inline: true
        }
      )
      .setTimestamp()
      .setFooter({
        text: 'VTP App - by ajzak'
      });
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    logger.error(`Ping command error: ${error.message}`, { stack: error.stack });
    
    if (interaction.deferred) {
      await interaction.editReply({
        content: 'Wystąpił błąd podczas sprawdzania pingu.',
      });
    } else {
      await interaction.reply({
        content: 'Wystąpił błąd podczas sprawdzania pingu.',
        ephemeral: true
      });
    }
  }
}

