import { PrismaClient } from '@prisma/client';
import { EmbedBuilder } from 'discord.js';
import { createClerkClient, verifyToken } from '@clerk/clerk-sdk-node';
import logger from '../config/logger.js';
import { config } from '../config/index.js';

const prisma = new PrismaClient();

// Check Clerk configuration
if (!config.clerk.secretKey) {
  logger.error('CLERK_SECRET_KEY is not set in environment variables');
}
if (!config.clerk.publishableKey) {
  logger.error('CLERK_PUBLISHABLE_KEY is not set in environment variables');
}

// Create Clerk client with secret key
const clerkClient = createClerkClient({
  secretKey: config.clerk.secretKey
});

class ClerkAuthService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Notifies user via Discord
   * @param {Object} user - User model instance
   * @param {string} action - Action type (role_updated, discord_updated, user_activated, user_deactivated)
   * @param {Client} client - Discord client
   */
  async notifyUser(user, action, client) {
    if (!user.discordId || !client) {
      logger.warn(`Cannot notify user ${user.clerkId}: missing discordId or client`);
      return;
    }

    const embeds = {
      role_updated: new EmbedBuilder()
        .setColor('#00ffa6')
        .setTitle('Rola zaktualizowana')
        .setDescription(`Twoja rola w systemie została zmieniona na: **${user.role}**`)
        .setTimestamp(),
      discord_updated: new EmbedBuilder()
        .setColor('#00ffa6')
        .setTitle('Discord ID zaktualizowane')
        .setDescription(`Twoje Discord ID w systemie zostało zaktualizowane.`)
        .setTimestamp(),
      user_activated: new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('Konto aktywowane')
        .setDescription(`Twoje konto w systemie zostało aktywowane.`)
        .setTimestamp(),
      user_deactivated: new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Konto dezaktywowane')
        .setDescription(`Twoje konto w systemie zostało dezaktywowane.`)
        .setTimestamp()
    };

    try {
      logger.info(`Sending Discord notification to user ${user.clerkId} for action: ${action}`);
      const discordUser = await client.users.fetch(user.discordId);
      await discordUser.send({ embeds: [embeds[action]] });
      logger.info(`Successfully notified user ${user.clerkId} via Discord`);
    } catch (error) {
      logger.error(`Failed to notify user ${user.clerkId} via Discord: ${error.message}`);
    }
  }

  /**
   * Notifies user that their account was updated
   * @param {Object} user - User model instance
   * @param {Client} client - Discord client
   */
  async notifyUserUpdated(user, client) {
    if (!user.discordId || !client) {
      logger.warn(`Cannot notify user ${user.clerkId}: missing discordId or client`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#00ffa6')
      .setTitle('Konto zaktualizowane')
      .setDescription(`Twoje konto w systemie zostało zaktualizowane.`)
      .setTimestamp();

    try {
      logger.info(`Sending account update notification to user ${user.clerkId}`);
      const discordUser = await client.users.fetch(user.discordId);
      await discordUser.send({ embeds: [embed] });
      logger.info(`Successfully notified user ${user.clerkId} about account update`);
    } catch (error) {
      logger.error(`Failed to notify user ${user.clerkId} about account update: ${error.message}`);
    }
  }

  /**
   * Verify JWT token with Clerk
   * @param {string} token - JWT token
   * @returns {Object|null} Token payload or null if invalid
   */
  async verifyToken(token) {
    try {
      logger.info('Verifying token with Clerk...');
      logger.info('Clerk secret key configured:', !!config.clerk.secretKey);
      
      // Verify the JWT token with Clerk using clerkClient
      const payload = await clerkClient.verifyToken(token);
      
      if (!payload) {
        logger.warn('Invalid token provided - no payload returned');
        return null;
      }
      
      logger.info('Token verified successfully for user:', payload.sub);
      return payload;
    } catch (error) {
      logger.error('Failed to verify token:', error);
      logger.error('Token verification error details:', error.message);
      logger.error('Error name:', error.name);
      logger.error('Error code:', error.code);
      return null;
    }
  }

  /**
   * Get user info from Clerk
   * @param {string} clerkId - Clerk user ID
   * @returns {Object} User info from Clerk
   */
  async getUserInfo(clerkId) {
    try {
      logger.info('Getting user info from Clerk for clerkId:', clerkId);
      logger.info('Clerk client available:', !!clerkClient);
      logger.info('Clerk client users available:', !!clerkClient?.users);
      
      // Get user info from Clerk API
      const clerkUser = await clerkClient.users.getUser(clerkId);
      
      if (!clerkUser) {
        logger.error('User not found in Clerk for clerkId:', clerkId);
        throw new Error('User not found in Clerk');
      }
      
      const userInfo = {
        clerkId: clerkUser.id,
        firstName: clerkUser.firstName || '',
        lastName: clerkUser.lastName || '',
        imageUrl: clerkUser.imageUrl || ''
      };
      
      logger.info('User info retrieved from Clerk:', userInfo);
      return userInfo;
    } catch (error) {
      logger.error('Failed to get user info from Clerk:', error);
      logger.error('Clerk API error details:', error.message);
      logger.error('Error name:', error.name);
      logger.error('Error code:', error.code);
      throw error;
    }
  }

  /**
   * Sync user to database (for first-time login)
   * @param {string} clerkId - Clerk user ID
   * @param {Object} clerkUserInfo - User info from Clerk
   * @returns {Object} Database user record
   */
  async syncUserToDatabase(clerkId, clerkUserInfo) {
    try {
      logger.info('Syncing user to database for clerkId:', clerkId);
      logger.info('Clerk user info:', clerkUserInfo);
      
      // Check if user already exists
      let user = await this.prisma.user.findUnique({ where: { clerkId } });
      
      if (user) {
        logger.info('User exists, updating...');
        // Update existing user
        user = await this.prisma.user.update({
          where: { clerkId },
          data: {
            firstName: clerkUserInfo.firstName,
            lastName: clerkUserInfo.lastName,
            updatedAt: new Date()
          }
        });
        logger.info('User updated successfully');
      } else {
        logger.info('User does not exist, creating new user...');
        // Create new user with default role
        user = await this.prisma.user.create({
          data: {
            clerkId,
            firstName: clerkUserInfo.firstName,
            lastName: clerkUserInfo.lastName,
            role: 'NONE', // Default role
            isActive: false, // Default inactive
            discordId: null
          }
        });
        logger.info('New user created successfully');
      }
      
      logger.info('User synced to database successfully:', {
        id: user.id,
        clerkId: user.clerkId,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      });
      
      return user;
    } catch (error) {
      logger.error('Failed to sync user to database:', error);
      logger.error('Database sync error details:', error.message);
      logger.error('Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Get user role from database
   * @param {string} clerkId - Clerk user ID
   * @returns {string} User role
   */
  async getUserRole(clerkId) {
    try {
      const user = await this.prisma.user.findUnique({ where: { clerkId } });
      return user ? user.role : null;
    } catch (error) {
      logger.error('Failed to get user role:', error);
      throw error;
    }
  }

  /**
   * Get user data from database
   * @param {string} clerkId - Clerk user ID
   * @returns {Object|null} User data from database
   */
  async getUserFromDatabase(clerkId) {
    try {
      const user = await this.prisma.user.findUnique({ where: { clerkId } });
      return user;
    } catch (error) {
      logger.error('Failed to get user from database:', error);
      throw error;
    }
  }

  /**
   * Check if user is active
   * @param {string} clerkId - Clerk user ID
   * @returns {boolean} True if user is active
   */
  async isUserActive(clerkId) {
    try {
      const user = await this.prisma.user.findUnique({ where: { clerkId } });
      return user ? user.isActive : false;
    } catch (error) {
      logger.error('Failed to check user active status:', error);
      throw error;
    }
  }

  /**
   * Update user role
   * @param {string} clerkId - Clerk user ID
   * @param {string} newRole - New role
   * @returns {Object} Updated user record
   */
  async updateUserRole(clerkId, newRole) {
    try {
      if (!['ADMIN', 'EMPLOYEE', 'NONE'].includes(newRole)) {
        throw new Error('Invalid role. Must be ADMIN, EMPLOYEE, or NONE');
      }
      
      const updatedUser = await this.prisma.user.update({
        where: { clerkId },
        data: { role: newRole }
      });
      
      logger.info('User role updated:', { clerkId, newRole });
      
      return updatedUser;
    } catch (error) {
      logger.error('Failed to update user role:', error);
      throw error;
    }
  }

  /**
   * Deactivate user
   * @param {string} clerkId - Clerk user ID
   * @returns {Object} Updated user record
   */
  async deactivateUser(clerkId) {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { clerkId },
        data: { isActive: false }
      });
      
      logger.info('User deactivated:', clerkId);
      
      return updatedUser;
    } catch (error) {
      logger.error('Failed to deactivate user:', error);
      throw error;
    }
  }

  /**
   * Activate user
   * @param {string} clerkId - Clerk user ID
   * @returns {Object} Updated user record
   */
  async activateUser(clerkId) {
    try {
      const user = await this.prisma.user.findUnique({ where: { clerkId } });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const updatedUser = await this.prisma.user.update({
        where: { clerkId },
        data: { isActive: true }
      });
      
      logger.info('User activated:', clerkId);
      
      return updatedUser;
    } catch (error) {
      logger.error('Failed to activate user:', error);
      throw error;
    }
  }

  /**
   * Update user Discord ID
   * @param {string} clerkId - Clerk user ID
   * @param {string} discordId - Discord user ID
   * @returns {Object} Updated user record
   */
  async updateUserDiscord(clerkId, discordId) {
    try {
      const user = await this.prisma.user.findUnique({ where: { clerkId } });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const updatedUser = await this.prisma.user.update({
        where: { clerkId },
        data: { discordId }
      });
      
      logger.info('User Discord ID updated:', { clerkId, discordId });
      
      return updatedUser;
    } catch (error) {
      logger.error('Failed to update user Discord ID:', error);
      throw error;
    }
  }

  /**
   * Update user Clerk ID
   * @param {string} oldClerkId - Current Clerk user ID
   * @param {string} newClerkId - New Clerk user ID
   * @returns {Object} Updated user record
   */
  async updateUserClerkId(oldClerkId, newClerkId) {
    try {
      const user = await this.prisma.user.findUnique({ where: { clerkId: oldClerkId } });
      
      if (!user) {
        throw new Error('User not found');
      }

      // Check if new clerkId already exists
      const existingUser = await this.prisma.user.findUnique({ where: { clerkId: newClerkId } });
      if (existingUser) {
        throw new Error('User with this Clerk ID already exists');
      }
      
      const updatedUser = await this.prisma.user.update({
        where: { clerkId: oldClerkId },
        data: { clerkId: newClerkId }
      });
      
      logger.info('User Clerk ID updated:', { oldClerkId, newClerkId });
      
      return updatedUser;
    } catch (error) {
      logger.error('Failed to update user Clerk ID:', error);
      throw error;
    }
  }

  /**
   * Update user name (firstName and lastName)
   * @param {string} clerkId - Clerk user ID
   * @param {string} firstName - First name
   * @param {string} lastName - Last name
   * @returns {Object} Updated user record
   */
  async updateUserName(clerkId, firstName, lastName) {
    try {
      const user = await this.prisma.user.findUnique({ where: { clerkId } });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const updatedUser = await this.prisma.user.update({
        where: { clerkId },
        data: { 
          firstName: firstName || null,
          lastName: lastName || null
        }
      });
      
      logger.info('User name updated:', { clerkId, firstName, lastName });
      
      return updatedUser;
    } catch (error) {
      logger.error('Failed to update user name:', error);
      throw error;
    }
  }

  /**
   * Create new user (admin only)
   * @param {Object} userData - User data
   * @returns {Object} Created user record
   */
  async createUser(userData) {
    try {
      const { firstName, lastName, role, discordId } = userData;
      
      if (!['ADMIN', 'EMPLOYEE', 'NONE'].includes(role)) {
        throw new Error('Invalid role. Must be ADMIN, EMPLOYEE, or NONE');
      }
      
      // Create new user
      const newUser = await this.prisma.user.create({
        data: {
          clerkId: `clerk_${Date.now()}`, // Generate temporary Clerk ID
          firstName: firstName || null,
          lastName: lastName || null,
          role,
          discordId: discordId || null,
          isActive: false
        }
      });
      
      logger.info('New user created:', { role });
      
      return newUser;
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Delete user (admin only)
   * @param {string} clerkId - Clerk user ID
   * @returns {Object} Deletion result
   */
  async deleteUser(clerkId) {
    try {
      const user = await this.prisma.user.findUnique({ where: { clerkId } });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check if user has any related data that would prevent deletion
      // For now, we'll allow deletion but this could be extended to check for:
      // - Assigned tasks
      // - Schedule assignments
      // - Other related records
      
      await this.prisma.user.delete({
        where: { clerkId }
      });
      
      logger.info('User deleted:', clerkId);
      
      return { message: 'User deleted successfully' };
    } catch (error) {
      logger.error('Failed to delete user:', error);
      throw error;
    }
  }

  /**
   * Get employees for schedule (filtered users with EMPLOYEE or ADMIN role)
   * @returns {Array} Array of active employees and admins
   */
  async getEmployeesForSchedule() {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: ['EMPLOYEE', 'ADMIN'] }
        },
        orderBy: { firstName: 'asc' }
      });
      
      logger.info('Retrieved employees for schedule');
      
      return users;
    } catch (error) {
      logger.error('Failed to get employees for schedule:', error);
      throw error;
    }
  }

  /**
   * Get all users (admin only)
   * @returns {Array} Array of all users with Clerk avatars
   */
  async getAllUsers() {
    try {
      const users = await this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
      });
      
      // Fetch Clerk data for each user to get avatars
      const usersWithAvatars = await Promise.all(
        users.map(async (user) => {
          try {
            const clerkUser = await clerkClient.users.getUser(user.clerkId);
            return {
              ...user,
              imageUrl: clerkUser.imageUrl || ''
            };
          } catch (error) {
            logger.warn(`Failed to fetch Clerk data for user ${user.clerkId}:`, error.message);
            return {
              ...user,
              imageUrl: ''
            };
          }
        })
      );
      
      logger.info('Retrieved all users with avatars');
      
      return usersWithAvatars;
    } catch (error) {
      logger.error('Failed to get all users:', error);
      throw error;
    }
  }
}

export default ClerkAuthService;
