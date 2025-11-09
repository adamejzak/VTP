import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import logger from '../../config/logger.js';

export const data = new SlashCommandBuilder()
  .setName('ranking')
  .setDescription('Pokaż ranking długości penisa')
  .addStringOption(option =>
    option
      .setName('okres')
      .setDescription('Okres rankingu')
      .setRequired(true)
      .addChoices(
        { name: 'Tydzień', value: 'week' },
        { name: 'Miesiąc', value: 'month' },
        { name: 'Ogólny', value: 'ogolny' }
      )
  );

export async function execute(interaction, { prisma }) {
  const period = interaction.options.getString('okres');
  
  try {
    
    // Calculate date range when needed
    const now = new Date();
    let startDate = null;
    let measurements;
    
    if (period === 'ogolny') {
      // All-time measurements
      measurements = await prisma.dickMeasurement.findMany();
    } else {
      if (period === 'week') {
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      
      // Get measurements for the period
      measurements = await prisma.dickMeasurement.findMany({
        where: {
          measuredAt: {
            gte: startDate
          }
        }
      });
    }
    
    if (!measurements.length) {
      const periodText = period === 'week' ? 'tygodniu' : 'miesiącu';
      return interaction.reply({
        content: `Brak pomiarów w tym ${periodText}. Użyj /dick, aby dodać pierwszy pomiar!`,
        ephemeral: true
      });
    }
    
    // Group measurements by user and calculate statistics
    const userStats = new Map();
    
    for (const measurement of measurements) {
      const userId = measurement.userId;
      if (!userStats.has(userId)) {
        userStats.set(userId, {
          userId: userId,
          measurements: [],
          totalSize: 0,
          count: 0,
          averageSize: 0
        });
      }
      
      const stats = userStats.get(userId);
      stats.measurements.push(measurement.size);
      stats.totalSize += measurement.size;
      stats.count++;
      stats.averageSize = stats.totalSize / stats.count;
    }
    
    // Convert to array and sort by average size
    const sortedStats = Array.from(userStats.values())
      .sort((a, b) => b.averageSize - a.averageSize);
    
    // Get Discord client to fetch user information
    const client = interaction.client;
    
    // Create ranking embed
    const embed = new EmbedBuilder()
      .setColor('#ff69b4')
      .setTitle(
        period === 'ogolny'
          ? '🏆 Ranking Penisów - Ogólny'
          : `🏆 Ranking Penisów - ${period === 'week' ? 'Tydzień' : 'Miesiąc'}`
      )
      .setDescription(
        period === 'ogolny'
          ? 'Ranking średniej długości penisa – wszystkie pomiary'
          : `Ranking średniej długości penisa od ${startDate.toLocaleDateString('pl-PL')}`
      )
      .setTimestamp();
    
    // Add top 10 users to embed
    const topUsers = sortedStats.slice(0, 10);
    for (let i = 0; i < topUsers.length; i++) {
      const stats = topUsers[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      
      // Try to get user info from Discord
      let userDisplayName = `Użytkownik ${stats.userId}`;
      if (client) {
        try {
          const discordUser = await client.users.fetch(stats.userId);
          userDisplayName = discordUser.username;
        } catch (error) {
          logger.warn(`Could not fetch user ${stats.userId}: ${error.message}`);
        }
      }
      
      embed.addFields({
        name: `${medal} ${userDisplayName}    |    Średnia: ${stats.averageSize.toFixed(1)} cm   |   ${stats.count} pomiarów`,
        value: '',
        inline: false
      });
    }
    
    // Add footer with total statistics
    const totalMeasurements = measurements.length;
    const totalUsers = sortedStats.length;
    const average = (measurements.reduce((sum, m) => sum + m.size, 0) / totalMeasurements).toFixed(1);
    
    embed.setFooter({
      text: period === 'ogolny'
        ? `Średnia globalna: ${average} cm`
        : `Średnia w okresie: ${average} cm`
    });
    
    await interaction.reply({ embeds: [embed] });
    
  } catch (error) {
    logger.error(`Ranking command error: ${error.message}`, { stack: error.stack });
    await interaction.reply({
      content: 'Wystąpił błąd podczas generowania rankingu.',
      ephemeral: true
    });
  }
}

