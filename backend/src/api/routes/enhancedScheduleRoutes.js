/**
 * Enhanced Schedule Routes
 * Defines API routes for enhanced schedule operations with store assignments
 */

import { Router } from 'express';
import { EnhancedScheduleController } from '../controllers/enhancedScheduleController.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireEmployee, requireAdmin } from '../../middleware/authorization.js';

/**
 * Creates enhanced schedule routes
 * @param {EnhancedScheduleService} enhancedScheduleService - Enhanced schedule service instance
 * @returns {Router} Express router
 */
export function createEnhancedScheduleRoutes(enhancedScheduleService) {
  const router = Router();
  const enhancedScheduleController = new EnhancedScheduleController(enhancedScheduleService);

  // All schedule routes require authentication and employee role or higher
  router.use(authenticateJWT);
  router.use(requireEmployee);

  // Schedule routes
  router.get('/', enhancedScheduleController.getAllSchedules.bind(enhancedScheduleController));
  router.post('/', enhancedScheduleController.createOrUpdateSchedule.bind(enhancedScheduleController));
  
  // Export routes (must be before /:month/:year to avoid conflicts)
  router.get('/:id/export', enhancedScheduleController.exportSchedule.bind(enhancedScheduleController));
  router.get('/:scheduleId/timesheet/:employeeId', enhancedScheduleController.generateTimesheet.bind(enhancedScheduleController));
  
  // Schedule by month/year routes
  router.get('/:month/:year', enhancedScheduleController.getScheduleByMonth.bind(enhancedScheduleController));
  router.put('/:month/:year', enhancedScheduleController.updateScheduleByMonth.bind(enhancedScheduleController));
  router.put('/:id', enhancedScheduleController.updateSchedule.bind(enhancedScheduleController));
  router.delete('/:id', requireAdmin, enhancedScheduleController.deleteSchedule.bind(enhancedScheduleController));
  
  // Assignment routes
  router.put('/:month/:year/assignments/:assignmentId', enhancedScheduleController.updateAssignment.bind(enhancedScheduleController));
  router.delete('/:month/:year/assignments/:assignmentId', enhancedScheduleController.deleteAssignment.bind(enhancedScheduleController));
  
  // AI routes
  router.post('/:month/:year/ai-generate', enhancedScheduleController.generateAISchedule.bind(enhancedScheduleController));
  
  // Ready status routes
  router.put('/:month/:year/ready', enhancedScheduleController.markScheduleAsReady.bind(enhancedScheduleController));
  router.delete('/:month/:year/ready', enhancedScheduleController.markScheduleAsNotReady.bind(enhancedScheduleController));
  
  // Notification routes
  router.post('/:scheduleId/notify', requireAdmin, enhancedScheduleController.sendScheduleNotification.bind(enhancedScheduleController));
  
  // Summary route
  router.get('/:month/:year/summary', enhancedScheduleController.getMonthlySummary.bind(enhancedScheduleController));

  return router;
}
