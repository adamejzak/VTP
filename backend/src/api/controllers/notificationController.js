import logger from '../../config/logger.js';
import { NotificationService } from '../../services/NotificationService.js';

/**
 * Controller for notification management
 */
export class NotificationController {
  constructor(prisma) {
    this.notificationService = new NotificationService(prisma);
  }

  /**
   * Get user's notifications
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const {
        limit = 50,
        offset = 0,
        unreadOnly = false,
        type = null
      } = req.query;

      const notifications = await this.notificationService.getUserNotifications(
        userId,
        {
          limit: parseInt(limit),
          offset: parseInt(offset),
          unreadOnly: unreadOnly === 'true',
          type
        }
      );

      res.json({
        notifications,
        count: notifications.length
      });
    } catch (error) {
      logger.error('Error getting notifications:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get notifications'
      });
    }
  }

  /**
   * Get unread notifications count
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;
      const count = await this.notificationService.getUnreadCount(userId);

      res.json({ count });
    } catch (error) {
      logger.error('Error getting unread count:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get unread count'
      });
    }
  }

  /**
   * Mark notification as read
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async markAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;

      const notification = await this.notificationService.markAsRead(
        notificationId,
        userId
      );

      res.json({
        success: true,
        notification
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to mark notification as read'
      });
    }
  }

  /**
   * Mark all notifications as read
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;
      const result = await this.notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        updatedCount: result.count
      });
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to mark all notifications as read'
      });
    }
  }

  /**
   * Delete notification
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteNotification(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;

      await this.notificationService.deleteNotification(notificationId, userId);

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting notification:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete notification'
      });
    }
  }

  /**
   * Create notification (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createNotification(req, res) {
    try {
      const { userId, title, message, type, actionUrl } = req.body;

      if (!userId || !title) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'User ID and title are required'
        });
      }

      const notification = await this.notificationService.createNotification({
        userId,
        title,
        message,
        type,
        actionUrl
      });

      res.status(201).json({
        success: true,
        notification
      });
    } catch (error) {
      logger.error('Error creating notification:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create notification'
      });
    }
  }

  /**
   * Create test notifications for current user (development)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createTestNotifications(req, res) {
    try {
      const userId = req.user.id;

      const testNotifications = [
        {
          userId,
          title: 'Witaj w systemie!',
          message: 'Twoje konto zostało aktywowane i możesz korzystać ze wszystkich funkcji.',
          type: 'SUCCESS'
        },
        {
          userId,
          title: 'Nowe zadanie przypisane',
          message: 'Otrzymałeś nowe zadanie do wykonania. Sprawdź szczegóły w zakładce zadań.',
          type: 'TASK',
          actionUrl: '/dashboard/tasks'
        },
        {
          userId,
          title: 'Aktualizacja harmonogramu',
          message: 'Twój harmonogram pracy na następny tydzień został zaktualizowany.',
          type: 'SCHEDULE',
          actionUrl: '/dashboard/schedule'
        },
        {
          userId,
          title: 'Ważne ogłoszenie',
          message: 'Pamiętaj o spotkaniu zespołu jutro o godzinie 10:00.',
          type: 'WARNING'
        },
        {
          userId,
          title: 'Nowa wiadomość',
          message: 'Otrzymałeś nową wiadomość od administratora.',
          type: 'MESSAGE'
        }
      ];

      const notifications = await Promise.all(
        testNotifications.map(data => this.notificationService.createNotification(data))
      );

      res.json({
        success: true,
        notifications,
        message: 'Test notifications created successfully'
      });
    } catch (error) {
      logger.error('Error creating test notifications:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create test notifications'
      });
    }
  }

  /**
   * Create bulk notifications (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createBulkNotifications(req, res) {
    try {
      const { userIds, title, message, type, actionUrl } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !title) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'User IDs array and title are required'
        });
      }

      const notifications = await this.notificationService.createBulkNotifications(
        userIds,
        { title, message, type, actionUrl }
      );

      res.status(201).json({
        success: true,
        notifications,
        count: notifications.length
      });
    } catch (error) {
      logger.error('Error creating bulk notifications:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create bulk notifications'
      });
    }
  }
}

export default NotificationController;
