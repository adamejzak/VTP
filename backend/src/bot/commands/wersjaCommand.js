import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import logger from '../../config/logger.js';

export const data = new SlashCommandBuilder()
  .setName('wersja')
  .setDescription('Pokaż aktualną wersję bota');

export async function execute(interaction) {
  try {
    const backendVersion = process.env.BACKEND_VERSION || process.env.APP_VERSION || '0.0.0';
    const frontendVersion = process.env.FRONTEND_VERSION || process.env.APP_VERSION || '0.0.0';
    const uptime = process.uptime();
    
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const uptimeText = days > 0 
      ? `${days}d ${hours}h ${minutes}m`
      : hours > 0 
        ? `${hours}h ${minutes}m`
        : `${minutes}m`;
    
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🤖 Informacje o bocie')
      .addFields(
        {
          name: '📦 Backend',
          value: `\`${backendVersion}\``,
          inline: true
        },
        {
          name: '⚙️ Frontend',
          value: `\`${frontendVersion}\``,
          inline: true
        },
        {
          name: '⏱️ Czas działania',
          value: uptimeText,
          inline: true
        }
      )
      .setTimestamp()
      .setFooter({
        text: 'VTP Discord Bot'
      });
    
    // Add GitHub repository button
    const githubButton = new ButtonBuilder()
      .setLabel('🔗 Kod źródłowy')
      .setStyle(ButtonStyle.Link)
      .setURL('https://github.com/adamejzak/VTP');
    
    const actionRow = new ActionRowBuilder()
      .addComponents(githubButton);
    
    await interaction.reply({ 
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
    
  } catch (error) {
    logger.error(`Wersja command error: ${error.message}`, { stack: error.stack });
    await interaction.reply({
      content: 'Wystąpił błąd podczas pobierania informacji o wersji.',
      ephemeral: true
    });
  }
}

