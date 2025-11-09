/**
 * Bot Controller
 * Handles Discord bot management operations
 */

import { ActivityType } from 'discord.js';
import logger from '../../config/logger.js';
import { BotStatusService } from '../../services/BotStatusService.js';
import { NotificationService } from '../../services/NotificationService.js';

/**
 * Controller for Discord bot operations
 */
export class BotController {
  constructor(discordClient, prisma) {
    this.discordClient = discordClient;
    this.prisma = prisma;
    this.statusService = new BotStatusService();
    this.notificationService = new NotificationService(prisma);
  }

  /**
   * Get bot information
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getBotInfo(req, res) {
    try {
      if (!this.discordClient) {
        return res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'Discord client not available' 
        });
      }

      const user = this.discordClient.user;
      if (!user) {
        return res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'Bot user not available' 
        });
      }

      // Get bot presence
      const presence = user.presence;
      const activity = presence?.activities?.[0] || null;

      // Calculate uptime
      const uptime = this.discordClient.uptime;
      const uptimeString = this.formatUptime(uptime);

      // Get guild count and user count
      const guilds = this.discordClient.guilds.cache.size;
      const users = this.discordClient.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);

      const botInfo = {
        id: user.id,
        username: user.username,
        avatar: user.displayAvatarURL({ dynamic: true, size: 256 }),
        status: presence?.status || 'offline',
        activity: activity ? {
          type: this.getActivityTypeString(activity.type),
          name: activity.name,
          url: activity.url
        } : null,
        guilds: guilds,
        users: users,
        uptime: uptimeString,
        version: '1.0.0' // You can get this from package.json or config
      };

      res.json(botInfo);
    } catch (error) {
      logger.error('Error getting bot info:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to get bot information' 
      });
    }
  }

  /**
   * Send message to Discord channel
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async sendMessage(req, res) {
    try {
      if (!this.discordClient) {
        return res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'Discord client not available' 
        });
      }

      const { channelId, message, embed } = req.body;

      if (!channelId || (!message && !embed)) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: 'Channel ID and message content are required' 
        });
      }

      // Get the channel
      const channel = await this.discordClient.channels.fetch(channelId);
      if (!channel) {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'Channel not found' 
        });
      }

      // Prepare message options
      const messageOptions = {};
      
      if (message) {
        messageOptions.content = message;
      }
      
      if (embed) {
        const { EmbedBuilder } = await import('discord.js');
        const embedBuilder = new EmbedBuilder()
          .setTitle(embed.title || '')
          .setDescription(embed.description || '')
          .setColor(embed.color || '#0099ff');
        
        if (embed.fields) {
          embedBuilder.addFields(embed.fields);
        }
        
        if (embed.footer) {
          embedBuilder.setFooter({ text: embed.footer });
        }
        
        if (embed.timestamp) {
          embedBuilder.setTimestamp();
        }
        
        messageOptions.embeds = [embedBuilder];
      }

      // Send the message
      const sentMessage = await channel.send(messageOptions);

      // Create notification for the sender
      try {
        await this.notificationService.createNotification({
          userId: req.user.id,
          title: 'Wiadomość wysłana na kanał',
          message: `Wiadomość została wysłana na kanał Discord`,
          type: 'SUCCESS'
        });
      } catch (notifError) {
        logger.error('Failed to create notification:', notifError);
      }

      res.json({
        success: true,
        messageId: sentMessage.id,
        channelId: sentMessage.channel.id,
        content: sentMessage.content,
        timestamp: sentMessage.createdAt
      });

    } catch (error) {
      logger.error('Error sending Discord message:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to send message' 
      });
    }
  }

  /**
   * Send direct message to Discord user(s)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async sendDirectMessage(req, res) {
    try {
      if (!this.discordClient) {
        return res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'Discord client not available' 
        });
      }

      const { userIds, message, embed } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: 'User IDs array is required' 
        });
      }

      if (!message && !embed) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: 'Message content is required' 
        });
      }

      // Prepare message options
      const messageOptions = {};
      
      if (message) {
        messageOptions.content = message;
      }
      
      if (embed) {
        const { EmbedBuilder } = await import('discord.js');
        const embedBuilder = new EmbedBuilder()
          .setTitle(embed.title || '')
          .setDescription(embed.description || '')
          .setColor(embed.color || '#0099ff');
        
        if (embed.fields) {
          embedBuilder.addFields(embed.fields);
        }
        
        if (embed.footer) {
          embedBuilder.setFooter({ text: embed.footer });
        }
        
        if (embed.timestamp) {
          embedBuilder.setTimestamp();
        }
        
        messageOptions.embeds = [embedBuilder];
      }

      const results = [];
      const errors = [];

      // Send DM to each user
      for (const userId of userIds) {
        try {
          const user = await this.discordClient.users.fetch(userId);
          if (!user) {
            errors.push({ userId, error: 'User not found' });
            continue;
          }

          const sentMessage = await user.send(messageOptions);
          results.push({
            userId,
            username: user.username,
            messageId: sentMessage.id,
            success: true
          });
        } catch (error) {
          logger.error(`Failed to send DM to user ${userId}:`, error);
          errors.push({ 
            userId, 
            error: error.message || 'Failed to send message' 
          });
        }
      }

      // Create notification for the sender
      try {
        await this.notificationService.createNotification({
          userId: req.user.id,
          title: 'Wiadomość DM wysłana',
          message: `Wysłano prywatną wiadomość do ${results.length} użytkowników${errors.length > 0 ? `, ${errors.length} nie powiodło się` : ''}`,
          type: results.length > 0 ? 'SUCCESS' : 'ERROR'
        });
      } catch (notifError) {
        logger.error('Failed to create notification:', notifError);
      }

      res.json({
        success: true,
        sent: results.length,
        failed: errors.length,
        results,
        errors
      });

    } catch (error) {
      logger.error('Error sending Discord DMs:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to send direct messages' 
      });
    }
  }

  /**
   * Update bot status/activity
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateBotStatus(req, res) {
    try {
      if (!this.discordClient) {
        return res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'Discord client not available' 
        });
      }

      const { type, name, url } = req.body;

      if (!type || !name) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: 'Type and name are required' 
        });
      }

      // Validate activity type
      const validTypes = ['PLAYING', 'WATCHING', 'LISTENING', 'STREAMING', 'COMPETING'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: 'Invalid activity type' 
        });
      }

      // Validate streaming URL
      if (type === 'STREAMING' && url && !this.isValidUrl(url)) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: 'Invalid streaming URL' 
        });
      }

      const user = this.discordClient.user;
      if (!user) {
        return res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'Bot user not available' 
        });
      }

      // Set bot presence
      const activityType = this.getActivityTypeEnum(type);
      const activity = {
        name: name,
        type: activityType
      };

      // Add URL for streaming
      if (type === 'STREAMING' && url) {
        activity.url = url;
      }

      await user.setPresence({
        activities: [activity],
        status: 'online'
      });

      // Save status to file
      await this.statusService.saveStatus({
        type: type,
        name: name,
        url: url,
        timestamp: new Date().toISOString()
      });

      logger.info(`Bot status updated: ${type} ${name}${url ? ` (${url})` : ''}`);

      res.json({ 
        message: 'Bot status updated successfully',
        activity: {
          type: type,
          name: name,
          url: url
        }
      });
    } catch (error) {
      logger.error('Error updating bot status:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to update bot status' 
      });
    }
  }

  /**
   * Clear bot status/activity
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async clearBotStatus(req, res) {
    try {
      if (!this.discordClient) {
        return res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'Discord client not available' 
        });
      }

      const user = this.discordClient.user;
      if (!user) {
        return res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'Bot user not available' 
        });
      }

      // Clear bot presence
      await user.setPresence({
        activities: [],
        status: 'online'
      });

      // Clear saved status
      await this.statusService.clearStatus();

      logger.info('Bot status cleared');

      res.json({ 
        message: 'Bot status cleared successfully'
      });
    } catch (error) {
      logger.error('Error clearing bot status:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to clear bot status' 
      });
    }
  }

  /**
   * Get bot logs (placeholder for future implementation)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getBotLogs(req, res) {
    try {
      const { limit = 100, level = 'all' } = req.query;
      const fs = await import('fs');
      const path = await import('path');
      
      // Path to the combined log file
      const logPath = path.join(process.cwd(), 'logs', 'combined.log');
      
      // Check if log file exists
      if (!fs.existsSync(logPath)) {
        return res.json({
          logs: [],
          message: 'No log file found'
        });
      }
      
      // Read log file
      const logContent = fs.readFileSync(logPath, 'utf8');
      const logLines = logContent.trim().split('\n').filter(line => line.trim());
      
      // Parse JSON logs and filter
      let logs = [];
      for (const line of logLines) {
        try {
          const logEntry = JSON.parse(line);
          
          // Filter by level if specified
          if (level !== 'all' && logEntry.level !== level) {
            continue;
          }
          
          // Filter bot-related logs
          if (logEntry.message && (
            logEntry.message.includes('Discord') ||
            logEntry.message.includes('bot') ||
            logEntry.message.includes('command') ||
            logEntry.message.includes('Bot') ||
            logEntry.service === 'vtp-backend'
          )) {
            logs.push({
              timestamp: logEntry.timestamp,
              level: logEntry.level,
              message: logEntry.message,
              service: logEntry.service,
              stack: logEntry.stack
            });
          }
        } catch (parseError) {
          // Skip invalid JSON lines
          continue;
        }
      }
      
      // Sort by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Apply limit
      logs = logs.slice(0, parseInt(limit));
      
      res.json({
        logs,
        total: logs.length,
        level: level,
        limit: parseInt(limit)
      });
      
    } catch (error) {
      logger.error('Error getting bot logs:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to get bot logs' 
      });
    }
  }

  /**
   * Get dick ranking
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getDickRanking(req, res) {
    try {
      const { period = 'all' } = req.query;
      
      // Use prisma from constructor
      if (!this.prisma) {
        return res.status(500).json({ 
          error: 'Internal Server Error', 
          message: 'Database not available' 
        });
      }

      // Calculate date range when needed
      const now = new Date();
      let startDate = null;
      let measurements;
      
      if (period === 'all') {
        // All-time measurements
        measurements = await this.prisma.dickMeasurement.findMany();
      } else {
        if (period === 'week') {
          startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        } else if (period === 'month') {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        
        // Get measurements for the period
        measurements = await this.prisma.dickMeasurement.findMany({
          where: {
            measuredAt: {
              gte: startDate
            }
          }
        });
      }
      
      if (!measurements.length) {
        const periodText = period === 'week' ? 'tygodniu' : period === 'month' ? 'miesiącu' : 'ogóle';
        return res.json({
          message: `Brak pomiarów w tym ${periodText}`,
          rankings: [],
          period: period
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
      const rankings = [];
      for (let i = 0; i < Math.min(sortedStats.length, 10); i++) {
        const stats = sortedStats[i];
        try {
          const user = await this.discordClient.users.fetch(stats.userId);
          rankings.push({
            rank: i + 1,
            userId: stats.userId,
            username: user.username,
            displayName: user.displayName || user.username,
            avatar: user.displayAvatarURL({ dynamic: true, size: 256 }),
            averageSize: parseFloat(stats.averageSize.toFixed(1)),
            totalMeasurements: stats.count,
            measurements: stats.measurements
          });
        } catch (error) {
          // User not found or not accessible
          rankings.push({
            rank: i + 1,
            userId: stats.userId,
            username: 'Nieznany użytkownik',
            displayName: 'Nieznany użytkownik',
            avatar: null,
            averageSize: parseFloat(stats.averageSize.toFixed(1)),
            totalMeasurements: stats.count,
            measurements: stats.measurements
          });
        }
      }

      res.json({
        rankings: rankings,
        period: period,
        totalUsers: sortedStats.length,
        totalMeasurements: measurements.length
      });
    } catch (error) {
      logger.error('Error getting dick ranking:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to get dick ranking' 
      });
    }
  }

  /**
   * Helper method to format uptime
   * @param {number} uptime - Uptime in milliseconds
   * @returns {string} Formatted uptime string
   */
  formatUptime(uptime) {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} dni, ${hours % 24} godzin`;
    } else if (hours > 0) {
      return `${hours} godzin, ${minutes % 60} minut`;
    } else if (minutes > 0) {
      return `${minutes} minut, ${seconds % 60} sekund`;
    } else {
      return `${seconds} sekund`;
    }
  }

  /**
   * Helper method to convert activity type string to enum
   * @param {string} type - Activity type string
   * @returns {number} Activity type enum
   */
  getActivityTypeEnum(type) {
    switch (type) {
      case 'PLAYING': return ActivityType.Playing;
      case 'WATCHING': return ActivityType.Watching;
      case 'LISTENING': return ActivityType.Listening;
      case 'STREAMING': return ActivityType.Streaming;
      case 'COMPETING': return ActivityType.Competing;
      default: return ActivityType.Playing;
    }
  }

  /**
   * Helper method to convert activity type enum to string
   * @param {number} type - Activity type enum
   * @returns {string} Activity type string
   */
  getActivityTypeString(type) {
    switch (type) {
      case ActivityType.Playing: return 'PLAYING';
      case ActivityType.Watching: return 'WATCHING';
      case ActivityType.Listening: return 'LISTENING';
      case ActivityType.Streaming: return 'STREAMING';
      case ActivityType.Competing: return 'COMPETING';
      default: return 'PLAYING';
    }
  }

  /**
   * Helper method to validate URL
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid URL
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

export default BotController;
