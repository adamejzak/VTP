import { SlashCommandBuilder } from 'discord.js';
import logger from '../../config/logger.js';

export const data = new SlashCommandBuilder()
  .setName('dick')
  .setDescription('Zmierz rozmiar swojego penisa');

export async function execute(interaction, { prisma }) {
  const user = interaction.user;
  
  logger.info(`Dick command executed by user ${user.id} (${user.tag})`);
  
  const size = parseFloat((Math.random() * (21 - 4) + 4).toFixed(1));
  
  // Store measurement in database
  try {
    logger.info(`Attempting to store dick measurement for user ${user.id} with size ${size}`);
    
    const result = await prisma.dickMeasurement.create({
      data: {
        userId: user.id,
        size: size,
        measuredAt: new Date()
      }
    });
    
    logger.info(`Successfully stored dick measurement: ${JSON.stringify(result)}`);
  } catch (error) {
    logger.error(`Failed to store dick measurement: ${error.message}`, { stack: error.stack });
  }
  
  // Create response
  const responses = [
    `🍆 Twój penis ma **${size} cm**!`,
  ];
  
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  
  await interaction.reply({ content: randomResponse });
}

