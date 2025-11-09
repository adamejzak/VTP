/**
 * Ready Event Handler
 * Handles the Discord bot ready event
 */

import { ActivityType } from 'discord.js';
import { config } from '../../config/index.js';
import logger from '../../config/logger.js';
import { BotStatusService } from '../../services/BotStatusService.js';

/**
 * Handles the ready event
 * @param {Client} client - Discord client
 * @param {Object} services - Services object
 */
export async function execute(client, services) {
  logger.info(`Bot logged in as ${client.user.tag}`);
  
  // Try to restore saved bot status, fallback to default
  const statusService = new BotStatusService();
  const savedStatus = await statusService.loadStatus();
  
  if (savedStatus) {
    // Restore saved status
    const activityType = getActivityTypeEnum(savedStatus.type);
    const activity = {
      name: savedStatus.name,
      type: activityType
    };
    
    if (savedStatus.type === 'STREAMING' && savedStatus.url) {
      activity.url = savedStatus.url;
    }
    
    client.user.setPresence({
      activities: [activity],
      status: 'online'
    });
    
    logger.info(`Bot status restored: ${savedStatus.type} ${savedStatus.name}`);
  } else {
    // Set bot presence without any activity (empty)
    client.user.setPresence({
      activities: [],
      status: 'online'
    });
    
    logger.info('Bot started with no activity - waiting for status to be set via panel');
  }

  // Set max listeners
  client.setMaxListeners(config.discord.maxListeners);

  // Start task scheduler if available
  if (services.taskScheduler) {
    services.taskScheduler.start();
  }

  logger.info('Discord bot is ready and operational');
}

/**
 * Helper function to convert activity type string to enum
 * @param {string} type - Activity type string
 * @returns {number} Activity type enum
 */
function getActivityTypeEnum(type) {
  switch (type) {
    case 'PLAYING': return ActivityType.Playing;
    case 'WATCHING': return ActivityType.Watching;
    case 'LISTENING': return ActivityType.Listening;
    case 'STREAMING': return ActivityType.Streaming;
    case 'COMPETING': return ActivityType.Competing;
    default: return ActivityType.Playing;
  }
}
