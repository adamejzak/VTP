import logger from '../config/logger.js';

/**
 * Service for managing notifications
 */
export class NotificationService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Retry database operation with exponential backoff
   * @param {Function} operation - Database operation to retry
   * @param {string} operationName - Name of the operation for logging
   * @param {number} maxRetries - Maximum number of retries
   * @returns {*} Result of the operation
   */
  async retryDatabaseOperation(operation, operationName, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Check if it's a timeout error that we should retry
        const isTimeoutError = error.code === 'P1008' || 
                              error.message?.includes('timeout') ||
                              error.message?.includes('busy');
        
        if (isTimeoutError && attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          logger.warn(`${operationName} attempt ${attempt} failed with timeout, retrying in ${delay}ms:`, error.message);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If it's not a timeout error or we've exhausted retries, throw the error
        logger.error(`Failed to ${operationName}:`, error);
        throw error;
      }
    }
    
    throw lastError;
  }

  /**
   * Create a new notification
   * @param {Object} data - Notification data
   * @returns {Object} Created notification
   */
  async createNotification(data) {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          title: data.title,
          message: data.message,
          type: data.type || 'INFO',
          actionUrl: data.actionUrl
        }
      });

      logger.info('Notification created:', {
        id: notification.id,
        userId: data.userId,
        title: data.title,
        type: data.type
      });

      return notification;
    } catch (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} User notifications
   */
  async getUserNotifications(userId, options = {}) {
    return await this.retryDatabaseOperation(async () => {
      const {
        limit = 50,
        offset = 0,
        unreadOnly = false,
        type = null
      } = options;

      const where = {
        userId,
        ...(unreadOnly && { read: false }),
        ...(type && { type })
      };

      const notifications = await this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      return notifications;
    }, 'getUserNotifications');
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for security)
   * @returns {Object} Updated notification
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await this.prisma.notification.update({
        where: {
          id: notificationId,
          userId // Ensure user can only mark their own notifications
        },
        data: {
          read: true
        }
      });

      return notification;
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {Object} Update result
   */
  async markAllAsRead(userId) {
    try {
      const result = await this.prisma.notification.updateMany({
        where: {
          userId,
          read: false
        },
        data: {
          read: true
        }
      });

      logger.info('Marked all notifications as read for user:', userId);
      return result;
    } catch (error) {
      logger.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for security)
   * @returns {Object} Deleted notification
   */
  async deleteNotification(notificationId, userId) {
    try {
      const notification = await this.prisma.notification.delete({
        where: {
          id: notificationId,
          userId // Ensure user can only delete their own notifications
        }
      });

      return notification;
    } catch (error) {
      logger.error('Failed to delete notification:', error);
      throw error;
    }
  }

  /**
   * Get unread notifications count for a user
   * @param {string} userId - User ID
   * @returns {number} Unread count
   */
  async getUnreadCount(userId) {
    return await this.retryDatabaseOperation(async () => {
      const count = await this.prisma.notification.count({
        where: {
          userId,
          read: false
        }
      });

      return count;
    }, 'getUnreadCount');
  }

  /**
   * Create notification for multiple users
   * @param {Array} userIds - Array of user IDs
   * @param {Object} notificationData - Notification data
   * @returns {Array} Created notifications
   */
  async createBulkNotifications(userIds, notificationData) {
    try {
      const notifications = await Promise.all(
        userIds.map(userId =>
          this.createNotification({
            ...notificationData,
            userId
          })
        )
      );

      logger.info('Bulk notifications created:', {
        count: notifications.length,
        title: notificationData.title
      });

      return notifications;
    } catch (error) {
      logger.error('Failed to create bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Clean up old notifications (older than 30 days)
   * @returns {Object} Cleanup result
   */
  async cleanupOldNotifications() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo
          },
          read: true // Only delete read notifications
        }
      });

      logger.info('Cleaned up old notifications:', result);
      return result;
    } catch (error) {
      logger.error('Failed to cleanup old notifications:', error);
      throw error;
    }
  }
}

export default NotificationService;
