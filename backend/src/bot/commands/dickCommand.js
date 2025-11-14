import { SlashCommandBuilder } from 'discord.js';
import logger from '../../config/logger.js';

const sizeRanges = [
  { min: 4, max: 8, weight: 0.2 },
  { min: 8, max: 15, weight: 0.35 },
  { min: 15, max: 21, weight: 0.45 }
];

function weightedRandomSize(ranges) {
  const totalWeight = ranges.reduce((sum, range) => sum + range.weight, 0);
  let pick = Math.random() * totalWeight;

  for (const range of ranges) {
    pick -= range.weight;
    if (pick <= 0) {
      const value = Math.random() * (range.max - range.min) + range.min;
      return parseFloat(value.toFixed(1));
    }
  }

  const fallback = ranges[ranges.length - 1];
  const fallbackValue =
    Math.random() * (fallback.max - fallback.min) + fallback.min;
  return parseFloat(fallbackValue.toFixed(1));
}

export const data = new SlashCommandBuilder()
  .setName('dick')
  .setDescription('Zmierz rozmiar swojego penisa');

export async function execute(interaction, { prisma }) {
  const user = interaction.user;
  
  logger.info(`Dick command executed by user ${user.id} (${user.tag})`);
  
  const size = weightedRandomSize(sizeRanges);
  
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
  
  const responses = [
    `🍆 Twój penis ma **${size} cm**!`,
  ];
  
  const randomResponse = responses[Math.floor(Math.random() * responses.length)];
  
  await interaction.reply({ content: randomResponse });
}

