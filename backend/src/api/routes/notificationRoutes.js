/**
 * Notification Routes
 * Defines API routes for notification management
 */

import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireEmployee, requireAdmin } from '../../middleware/authorization.js';

/**
 * Creates notification routes
 * @param {PrismaClient} prisma - Prisma client instance
 * @returns {Router} Express router
 */
export function createNotificationRoutes(prisma) {
  const router = Router();
  const notificationController = new NotificationController(prisma);

  // All notification routes require authentication
  router.use(authenticateJWT);

  // User notification routes (employee and admin)
  router.get('/', requireEmployee, notificationController.getNotifications.bind(notificationController));
  router.get('/count', requireEmployee, notificationController.getUnreadCount.bind(notificationController));
  router.put('/:notificationId/read', requireEmployee, notificationController.markAsRead.bind(notificationController));
  router.put('/read-all', requireEmployee, notificationController.markAllAsRead.bind(notificationController));
  router.delete('/:notificationId', requireEmployee, notificationController.deleteNotification.bind(notificationController));

  // Admin-only routes for creating notifications
  router.post('/', requireAdmin, notificationController.createNotification.bind(notificationController));
  router.post('/bulk', requireAdmin, notificationController.createBulkNotifications.bind(notificationController));
  
  // Development route for testing notifications
  router.post('/test', requireEmployee, notificationController.createTestNotifications.bind(notificationController));

  return router;
}
