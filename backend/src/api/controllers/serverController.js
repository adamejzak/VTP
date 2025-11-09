/**
 * Server Controller
 * Handles Discord server management for the web panel
 */

import logger from '../../config/logger.js';

/**
 * Controller for Discord server operations
 */
export class ServerController {
  constructor(discordClient) {
    this.discordClient = discordClient;
  }

  /**
   * Get the single server where the bot is installed
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getServer(req, res) {
    try {
      if (!this.discordClient) {
        return res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'Discord client not available' 
        });
      }

      // Get the first (and only) server
      const guild = this.discordClient.guilds.cache.first();
      
      if (!guild) {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'Bot is not in any server' 
        });
      }

      const serverInfo = {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ dynamic: true, size: 256 }),
        memberCount: guild.memberCount,
        ownerId: guild.ownerId,
        joinedAt: guild.joinedAt,
        features: guild.features,
        permissions: guild.members.me?.permissions.toArray() || []
      };

      res.json(serverInfo);
    } catch (error) {
      logger.error('Error getting server:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to get server information' 
      });
    }
  }

  /**
   * Get detailed server information with channels and roles
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getServerDetails(req, res) {
    try {
      if (!this.discordClient) {
        return res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'Discord client not available' 
        });
      }

      const guild = this.discordClient.guilds.cache.first();
      
      if (!guild) {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'Bot is not in any server' 
        });
      }

      // Get additional server information
      const channels = guild.channels.cache.map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        position: channel.position,
        parentId: channel.parentId
      }));

      const roles = guild.roles.cache.map(role => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
        permissions: role.permissions.toArray(),
        mentionable: role.mentionable,
        hoist: role.hoist
      }));

      const serverInfo = {
        id: guild.id,
        name: guild.name,
        description: guild.description,
        icon: guild.iconURL({ dynamic: true, size: 256 }),
        banner: guild.bannerURL({ dynamic: true, size: 1024 }),
        memberCount: guild.memberCount,
        ownerId: guild.ownerId,
        joinedAt: guild.joinedAt,
        features: guild.features,
        permissions: guild.members.me?.permissions.toArray() || [],
        channels: channels,
        roles: roles,
        verificationLevel: guild.verificationLevel,
        explicitContentFilter: guild.explicitContentFilter,
        defaultMessageNotifications: guild.defaultMessageNotifications,
        mfaLevel: guild.mfaLevel,
        premiumTier: guild.premiumTier,
        premiumSubscriptionCount: guild.premiumSubscriptionCount
      };

      res.json(serverInfo);
    } catch (error) {
      logger.error('Error getting server details:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to get server information' 
      });
    }
  }

  /**
   * Get server members
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getServerMembers(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query;

      if (!this.discordClient) {
        return res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'Discord client not available' 
        });
      }

      const guild = this.discordClient.guilds.cache.first();
      
      if (!guild) {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'Bot is not in any server' 
        });
      }

      // Fetch members (this might need to be paginated for large servers)
      await guild.members.fetch();
      
      const members = guild.members.cache
        .map(member => ({
          id: member.id,
          username: member.user.username,
          displayName: member.displayName,
          avatar: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
          joinedAt: member.joinedAt,
          roles: member.roles.cache.map(role => ({
            id: role.id,
            name: role.name,
            color: role.color
          })),
          permissions: member.permissions.toArray(),
          isBot: member.user.bot
        }))
        .slice(offset, offset + parseInt(limit));

      res.json({
        members,
        total: guild.memberCount,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
    } catch (error) {
      logger.error('Error getting server members:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to get server members' 
      });
    }
  }

  /**
   * Get server channels
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getServerChannels(req, res) {
    try {
      logger.info('Getting server channels...');
      
      if (!this.discordClient) {
        logger.error('Discord client not available');
        return res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'Discord client not available' 
        });
      }

      const guild = this.discordClient.guilds.cache.first();
      
      if (!guild) {
        logger.error('Bot is not in any server');
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'Bot is not in any server' 
        });
      }

      logger.info(`Found guild: ${guild.name} (${guild.id})`);

      const channels = guild.channels.cache
        .sort((a, b) => a.position - b.position)
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          position: channel.position,
          parentId: channel.parentId,
          topic: channel.topic,
          nsfw: channel.nsfw,
          bitrate: channel.bitrate,
          userLimit: channel.userLimit
        }));

      logger.info(`Returning ${channels.length} channels`);
      res.json({ channels });
    } catch (error) {
      logger.error('Error getting server channels:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to get server channels' 
      });
    }
  }

  /**
   * Get bot permissions in server
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getBotPermissions(req, res) {
    try {
      if (!this.discordClient) {
        return res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'Discord client not available' 
        });
      }

      const guild = this.discordClient.guilds.cache.first();
      
      if (!guild) {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'Bot is not in any server' 
        });
      }

      const botMember = guild.members.me;
      
      if (!botMember) {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'Bot member not found in server' 
        });
      }

      const permissions = {
        has: botMember.permissions.toArray(),
        missing: [],
        canManageServer: botMember.permissions.has('ManageGuild'),
        canManageChannels: botMember.permissions.has('ManageChannels'),
        canManageRoles: botMember.permissions.has('ManageRoles'),
        canManageMessages: botMember.permissions.has('ManageMessages'),
        canSendMessages: botMember.permissions.has('SendMessages'),
        canEmbedLinks: botMember.permissions.has('EmbedLinks'),
        canAttachFiles: botMember.permissions.has('AttachFiles'),
        canUseSlashCommands: botMember.permissions.has('UseApplicationCommands')
      };

      res.json(permissions);
    } catch (error) {
      logger.error('Error getting bot permissions:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to get bot permissions' 
      });
    }
  }
}

export default ServerController;
