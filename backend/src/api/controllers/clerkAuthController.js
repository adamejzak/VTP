/**
 * Clerk Authentication Controller
 * Handles Clerk JWT authentication endpoints
 */

import logger from '../../config/logger.js';

/**
 * Controller for Clerk authentication operations
 */
export class ClerkAuthController {
  constructor(clerkAuthService) {
    this.clerkAuthService = clerkAuthService;
  }

  /**
   * Get current user information
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getCurrentUser(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'No authenticated user' 
        });
      }

      // Get user data from database (including firstName and lastName)
      const dbUser = await this.clerkAuthService.getUserFromDatabase(req.user.clerkId);
      
      if (!dbUser) {
        return res.status(404).json({ 
          error: 'User not found', 
          message: 'User not found in database' 
        });
      }
      
      const userInfo = {
        clerkId: dbUser.clerkId,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        role: dbUser.role || 'NONE',
        isAuthenticated: true
      };

      res.json(userInfo);
    } catch (error) {
      logger.error('Error getting current user:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to get user information' 
      });
    }
  }

  /**
   * Get employees for schedule (filtered users with EMPLOYEE or ADMIN role)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getEmployeesForSchedule(req, res) {
    try {
      const employees = await this.clerkAuthService.getEmployeesForSchedule();
      
      res.json({
        success: true,
        users: employees
      });
    } catch (error) {
      logger.error('Error getting employees for schedule:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to get employees' 
      });
    }
  }

  /**
   * Sync user to database (for first-time login)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async syncUser(req, res) {
    try {
      logger.info('Sync user request received');
      
      // Get JWT token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('No valid authorization header provided');
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'No valid authorization header provided' 
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      if (!token) {
        logger.warn('No token provided');
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'No token provided' 
        });
      }

      logger.info('Verifying token...');
      // Verify the JWT token with Clerk
      const payload = await this.clerkAuthService.verifyToken(token);
      
      if (!payload) {
        logger.warn('Invalid token provided');
        return res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'Invalid token' 
        });
      }

      const clerkId = payload.sub;
      logger.info('Token verified, clerkId:', clerkId);

      // Get user info from Clerk
      logger.info('Getting user info from Clerk...');
      const clerkUserInfo = await this.clerkAuthService.getUserInfo(clerkId);
      logger.info('User info from Clerk:', clerkUserInfo);
      
      // Sync to database
      logger.info('Syncing user to database...');
      const dbUser = await this.clerkAuthService.syncUserToDatabase(
        clerkId, 
        clerkUserInfo
      );
      logger.info('User synced successfully:', dbUser);

      res.json({
        message: 'User synced successfully',
        user: {
          id: dbUser.id,
          clerkId: dbUser.clerkId,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          role: dbUser.role,
          isActive: dbUser.isActive
        }
      });
    } catch (error) {
      logger.error('Error syncing user:', error);
      logger.error('Error stack:', error.stack);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to sync user',
        details: error.message
      });
    }
  }

  /**
   * Get all users (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAllUsers(req, res) {
    try {
      const users = await this.clerkAuthService.getAllUsers();
      
      res.json({
        users: users.map(user => ({
          id: user.id,
          clerkId: user.clerkId,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          discordId: user.discordId,
          isActive: user.isActive,
          imageUrl: user.imageUrl,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }))
      });
    } catch (error) {
      logger.error('Error getting all users:', error);
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to get users' 
      });
    }
  }

  /**
   * Update user role (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateUserRole(req, res) {
    try {
      const { clerkId } = req.params;
      const { role } = req.body;

      if (!role || !['ADMIN', 'EMPLOYEE', 'NONE'].includes(role)) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: 'Invalid role. Must be ADMIN, EMPLOYEE, or NONE' 
        });
      }

      const updatedUser = await this.clerkAuthService.updateUserRole(clerkId, role);
      
      // Send Discord notification if user has Discord ID
      if (updatedUser.discordId) {
        const discordClient = req.app.get('discordClient');
        if (discordClient) {
          await this.clerkAuthService.notifyUserUpdated(updatedUser, discordClient);
        }
      }

      res.json({
        message: 'User role updated successfully',
        user: {
          id: updatedUser.id,
          clerkId: updatedUser.clerkId,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          isActive: updatedUser.isActive
        }
      });
    } catch (error) {
      logger.error('Error updating user role:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'User not found' 
        });
      }
      
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to update user role' 
      });
    }
  }

  /**
   * Deactivate user (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deactivateUser(req, res) {
    try {
      const { clerkId } = req.params;
      
      const updatedUser = await this.clerkAuthService.deactivateUser(clerkId);
      
      // Send Discord notification if user has Discord ID
      if (updatedUser.discordId) {
        const discordClient = req.app.get('discordClient');
        if (discordClient) {
          await this.clerkAuthService.notifyUserUpdated(updatedUser, discordClient);
        }
      }

      res.json({
        message: 'User deactivated successfully',
        user: {
          id: updatedUser.id,
          clerkId: updatedUser.clerkId,
          role: updatedUser.role,
          isActive: updatedUser.isActive
        }
      });
    } catch (error) {
      logger.error('Error deactivating user:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'User not found' 
        });
      }
      
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to deactivate user' 
      });
    }
  }

  /**
   * Activate user (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async activateUser(req, res) {
    try {
      const { clerkId } = req.params;
      
      const updatedUser = await this.clerkAuthService.activateUser(clerkId);
      
      // Send Discord notification if user has Discord ID
      if (updatedUser.discordId) {
        const discordClient = req.app.get('discordClient');
        if (discordClient) {
          await this.clerkAuthService.notifyUserUpdated(updatedUser, discordClient);
        }
      }

      res.json({
        message: 'User activated successfully',
        user: {
          id: updatedUser.id,
          clerkId: updatedUser.clerkId,
          role: updatedUser.role,
          isActive: updatedUser.isActive
        }
      });
    } catch (error) {
      logger.error('Error activating user:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'User not found' 
        });
      }
      
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to activate user' 
      });
    }
  }

  /**
   * Update user Discord ID (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateUserDiscord(req, res) {
    try {
      const { clerkId } = req.params;
      const { discordId } = req.body;

      if (!discordId) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: 'Discord ID is required' 
        });
      }

      const updatedUser = await this.clerkAuthService.updateUserDiscord(clerkId, discordId);
      
      // Send Discord notification
      const discordClient = req.app.get('discordClient');
      if (discordClient) {
        await this.clerkAuthService.notifyUserUpdated(updatedUser, discordClient);
      }

      res.json({
        message: 'User Discord ID updated successfully',
        user: {
          id: updatedUser.id,
          clerkId: updatedUser.clerkId,
          role: updatedUser.role,
          discordId: updatedUser.discordId,
          isActive: updatedUser.isActive
        }
      });
    } catch (error) {
      logger.error('Error updating user Discord ID:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'User not found' 
        });
      }
      
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to update user Discord ID' 
      });
    }
  }

  /**
   * Update user data (admin only) - single endpoint for all user updates
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateUser(req, res) {
    try {
      const { clerkId } = req.params;
      const { role, discordId, isActive, newClerkId, firstName, lastName } = req.body;

      // Validate role if provided
      if (role && !['ADMIN', 'EMPLOYEE', 'NONE'].includes(role)) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: 'Invalid role. Must be ADMIN, EMPLOYEE, or NONE' 
        });
      }

      let updatedUser;
      let currentClerkId = clerkId;

      // Update Clerk ID if provided (must be done first as it changes the identifier)
      if (newClerkId && newClerkId !== clerkId) {
        updatedUser = await this.clerkAuthService.updateUserClerkId(clerkId, newClerkId);
        currentClerkId = newClerkId; // Update the current clerkId for subsequent operations
      }

      // Update name if provided
      if (firstName !== undefined || lastName !== undefined) {
        updatedUser = await this.clerkAuthService.updateUserName(currentClerkId, firstName, lastName);
      }

      // Update role if provided
      if (role !== undefined) {
        updatedUser = await this.clerkAuthService.updateUserRole(currentClerkId, role);
      }

      // Update Discord ID if provided
      if (discordId !== undefined) {
        updatedUser = await this.clerkAuthService.updateUserDiscord(currentClerkId, discordId);
      }

      // Update active status if provided
      if (isActive !== undefined) {
        if (isActive) {
          updatedUser = await this.clerkAuthService.activateUser(currentClerkId);
        } else {
          updatedUser = await this.clerkAuthService.deactivateUser(currentClerkId);
        }
      }

      // Send single Discord notification if user has Discord ID and any changes were made
      if (updatedUser && updatedUser.discordId) {
        const discordClient = req.app.get('discordClient');
        if (discordClient) {
          await this.clerkAuthService.notifyUserUpdated(updatedUser, discordClient);
        }
      }

      res.json({
        message: 'User updated successfully',
        user: {
          id: updatedUser.id,
          clerkId: updatedUser.clerkId,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          role: updatedUser.role,
          discordId: updatedUser.discordId,
          isActive: updatedUser.isActive
        }
      });
    } catch (error) {
      logger.error('Error updating user:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'User not found' 
        });
      }
      
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to update user' 
      });
    }
  }

  /**
   * Delete user (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteUser(req, res) {
    try {
      const { clerkId } = req.params;
      
      const result = await this.clerkAuthService.deleteUser(clerkId);
      
      res.json({
        message: 'User deleted successfully',
        result
      });
    } catch (error) {
      logger.error('Error deleting user:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({ 
          error: 'Not Found', 
          message: 'User not found' 
        });
      }
      
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to delete user' 
      });
    }
  }

  /**
   * Create new user (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createUser(req, res) {
    try {
      const { firstName, lastName, role, discordId } = req.body;

      if (!firstName || !lastName || !role) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: 'firstName, lastName and role are required' 
        });
      }

      if (!['ADMIN', 'EMPLOYEE', 'NONE'].includes(role)) {
        return res.status(400).json({ 
          error: 'Bad Request', 
          message: 'Invalid role. Must be ADMIN, EMPLOYEE or NONE' 
        });
      }

      const newUser = await this.clerkAuthService.createUser({
        firstName,
        lastName,
        role,
        discordId
      });

      res.json({
        message: 'User created successfully',
        user: {
          id: newUser.id,
          clerkId: newUser.clerkId,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
          discordId: newUser.discordId,
          isActive: newUser.isActive,
          createdAt: newUser.createdAt
        }
      });
    } catch (error) {
      logger.error('Error creating user:', error);
      
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to create user' 
      });
    }
  }
}

export default ClerkAuthController;
