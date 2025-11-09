/**
 * Enhanced Schedule Controller
 * Handles HTTP requests for enhanced schedule operations with store assignments
 */

import logger from '../../config/logger.js';
import { prisma } from '../../lib/prisma.js';

/**
 * Controller for enhanced schedule operations
 */
export class EnhancedScheduleController {
  constructor(enhancedScheduleService) {
    this.enhancedScheduleService = enhancedScheduleService;
  }

  /**
   * Creates a new schedule with store assignments
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createSchedule(req, res) {
    try {
      const { month, year, assignments } = req.body;
      
      if (!month || !year || !assignments) {
        return res.status(400).json({
          success: false,
          message: 'Month, year, and assignments are required'
        });
      }

      const schedule = await this.enhancedScheduleService.createSchedule(
        { month, year, assignments },
        req.discordClient,
        req.user.clerkId
      );

      logger.info(`Schedule created for ${month + 1}/${year} by user ${req.user.clerkId}`);

      res.status(201).json({
        success: true,
        message: 'Schedule created successfully',
        data: schedule
      });
    } catch (error) {
      logger.error('Error creating schedule:', error.message);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Creates a new schedule or updates existing one with store assignments
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createOrUpdateSchedule(req, res) {
    try {
      const { month, year, assignments } = req.body;
      
      if (!month || !year || !assignments) {
        return res.status(400).json({
          success: false,
          message: 'Month, year, and assignments are required'
        });
      }

      const schedule = await this.enhancedScheduleService.createOrUpdateSchedule(
        { month, year, assignments },
        req.discordClient,
        req.user.clerkId
      );

      logger.info(`Schedule created/updated for ${month + 1}/${year} by user ${req.user.clerkId}`);

      res.status(200).json({
        success: true,
        message: 'Schedule created/updated successfully',
        data: schedule
      });
    } catch (error) {
      logger.error('Error creating/updating schedule:', error.message);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Gets all schedules
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAllSchedules(req, res) {
    try {
      const schedules = await this.enhancedScheduleService.getAllSchedules();

      res.json({
        success: true,
        data: schedules
      });
    } catch (error) {
      logger.error('Error fetching schedules:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch schedules'
      });
    }
  }

  /**
   * Gets schedule by month and year
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getScheduleByMonth(req, res) {
    try {
      const { month, year } = req.params;
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);

      if (isNaN(monthNum) || isNaN(yearNum)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid month or year'
        });
      }

      const schedule = await this.enhancedScheduleService.getScheduleByMonth(monthNum - 1, yearNum); // Convert 1-based to 0-based

      if (!schedule) {
        return res.status(404).json({
          success: false,
          message: 'Schedule not found'
        });
      }

      res.json({
        success: true,
        data: schedule
      });
    } catch (error) {
      logger.error('Error fetching schedule:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch schedule'
      });
    }
  }

  /**
   * Updates a schedule
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateSchedule(req, res) {
    try {
      const { id } = req.params;
      const { month, year, assignments } = req.body;

      if (!month || !year || !assignments) {
        return res.status(400).json({
          success: false,
          message: 'Month, year, and assignments are required'
        });
      }

      const schedule = await this.enhancedScheduleService.updateSchedule(
        id,
        { month, year, assignments },
        req.discordClient,
        req.user.clerkId
      );

      logger.info(`Schedule updated: ${id} by user ${req.user.clerkId}`);

      res.json({
        success: true,
        message: 'Schedule updated successfully',
        data: schedule
      });
    } catch (error) {
      logger.error('Error updating schedule:', error.message);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Updates an existing schedule by month and year
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateScheduleByMonth(req, res) {
    try {
      const { month, year } = req.params;
      const { assignments } = req.body;

      logger.info('Update schedule by month request:', {
        month,
        year,
        monthParsed: parseInt(month),
        monthConverted: parseInt(month) - 1,
        assignmentsCount: assignments?.length || 0,
        user: req.user
      });

      if (!assignments) {
        return res.status(400).json({
          success: false,
          message: 'Assignments are required'
        });
      }

      const schedule = await this.enhancedScheduleService.updateScheduleByMonth(
        parseInt(month) - 1, // Convert 1-based month to 0-based
        parseInt(year),
        { assignments },
        req.discordClient,
        req.user.clerkId
      );

      logger.info(`Schedule updated for ${month}/${year} by user ${req.user.clerkId}`);

      res.json({
        success: true,
        message: 'Schedule updated successfully',
        data: schedule
      });
    } catch (error) {
      logger.error('Error updating schedule by month:', error.message);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Deletes a schedule
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteSchedule(req, res) {
    try {
      const { id } = req.params;
      const result = await this.enhancedScheduleService.deleteSchedule(id, req.discordClient);

      logger.info(`Schedule deleted: ${id} by user ${req.user.clerkId}`);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      logger.error('Error deleting schedule:', error.message);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Exports schedule to Excel
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async exportSchedule(req, res) {
    try {
      const { id } = req.params;
      const scheduleId = parseInt(id, 10);
      
      if (isNaN(scheduleId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid schedule ID'
        });
      }
      
      const buffer = await this.enhancedScheduleService.exportSchedule(scheduleId);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="schedule-${id}.xlsx"`);
      res.send(buffer);
    } catch (error) {
      logger.error('Error exporting schedule:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to export schedule'
      });
    }
  }

  /**
   * Generates employee timesheet
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async generateTimesheet(req, res) {
    try {
      const { scheduleId, employeeId } = req.params;
      
      logger.info(`Generating timesheet for scheduleId: ${scheduleId}, employeeId: ${employeeId}`);
      
      const scheduleIdInt = parseInt(scheduleId, 10);
      
      if (isNaN(scheduleIdInt)) {
        logger.error(`Invalid schedule ID: ${scheduleId}`);
        return res.status(400).json({
          success: false,
          message: 'Invalid schedule ID'
        });
      }
      
      // Get employee and schedule info for filename first
      logger.info(`Looking up employee with ID: ${employeeId}`);
      // Try to find by ID first, then by clerkId if not found
      let employee = await prisma.user.findUnique({ 
        where: { id: employeeId } 
      });
      
      if (!employee) {
        logger.info(`Employee not found by ID, trying clerkId: ${employeeId}`);
        employee = await prisma.user.findUnique({ 
          where: { clerkId: employeeId } 
        });
      }
      
      logger.info(`Looking up schedule with ID: ${scheduleIdInt}`);
      const schedule = await prisma.schedule.findUnique({ 
        where: { id: scheduleIdInt } 
      });

      if (!employee) {
        logger.error(`Employee not found with ID: ${employeeId}`);
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      
      if (!schedule) {
        logger.error(`Schedule not found with ID: ${scheduleIdInt}`);
        return res.status(404).json({
          success: false,
          message: 'Schedule not found'
        });
      }

      logger.info(`Found employee: ${employee.firstName} ${employee.lastName}, schedule: ${schedule.month}/${schedule.year}`);
      
      // Use EnhancedScheduleService (same as Discord)
      const buffer = await this.enhancedScheduleService.generateEmployeeTimesheet(scheduleIdInt, employeeId);

      // Create readable filename with proper Content-Disposition encoding (ASCII fallback + UTF-8 filename*)
      const monthName = new Date(schedule.year, schedule.month).toLocaleString('pl-PL', { month: 'long' });
      const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      const employeeName = employee.firstName && employee.lastName 
        ? `${employee.firstName} ${employee.lastName}`
        : employee.clerkId || 'Pracownik';

      const utf8Filename = `Godzinówka - ${employeeName} (${capitalizedMonthName}).xlsx`;

      // ASCII-safe fallback: strip diacritics and non-ASCII, collapse spaces
      const toAscii = (s) => s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s\-_.()]/g, '')
        .trim()
        .replace(/\s+/g, ' ');
      const asciiEmployee = toAscii(employeeName);
      const asciiMonth = toAscii(capitalizedMonthName);
      const asciiFilename = `Godzinowka - ${asciiEmployee} (${asciiMonth}).xlsx`;

      const contentDisposition = `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', contentDisposition);
      res.send(buffer);
    } catch (error) {
      logger.error('Error generating timesheet:', error.message);
      res.status(500).json({
        success: false,
        message: `Failed to generate timesheet: ${error.message}`
      });
    }
  }

  /**
   * Gets monthly summary
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getMonthlySummary(req, res) {
    try {
      const { month, year } = req.params;
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);

      if (isNaN(monthNum) || isNaN(yearNum)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid month or year'
        });
      }

      const summary = await this.enhancedScheduleService.getMonthlySummary(monthNum - 1, yearNum); // Convert 1-based to 0-based

      if (!summary) {
        return res.status(404).json({
          success: false,
          message: 'Schedule not found'
        });
      }

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error fetching monthly summary:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch monthly summary'
      });
    }
  }

  /**
   * Delete a specific assignment from a schedule
   * DELETE /:month/:year/assignments/:assignmentId
   */
  async deleteAssignment(req, res) {
    try {
      const { month, year, assignmentId } = req.params;
      const userId = req.user.id;

      const result = await this.enhancedScheduleService.deleteAssignment(
        parseInt(month) - 1, // Convert 1-based month to 0-based
        parseInt(year),
        assignmentId,
        userId,
        req.discordClient
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'Assignment deleted successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || 'Failed to delete assignment'
        });
      }
    } catch (error) {
      console.error('Error deleting assignment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete assignment'
      });
    }
  }

  /**
   * Updates a single assignment
   * PUT /:month/:year/assignments/:assignmentId
   */
  async updateAssignment(req, res) {
    try {
      const { assignmentId } = req.params;
      const { storeId, hours } = req.body;
      const userId = req.user.id;

      logger.info('Update assignment request:', {
        assignmentId,
        storeId,
        hours,
        userId,
        user: req.user,
        hasUserId: !!userId
      });

      if (!storeId) {
        return res.status(400).json({
          success: false,
          message: 'Store ID is required'
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const updatedAssignment = await this.enhancedScheduleService.updateAssignment(
        assignmentId,
        { storeId, hours },
        userId,
        req.discordClient
      );

      logger.info(`Assignment updated: ${assignmentId} by user ${userId}`);

      res.json({
        success: true,
        message: 'Assignment updated successfully',
        data: updatedAssignment
      });
    } catch (error) {
      logger.error('Error updating assignment:', error.message);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Send manual notification for schedule
   * POST /:scheduleId/notify
   */
  async sendScheduleNotification(req, res) {
    try {
      const { scheduleId } = req.params;
      const userId = req.user.id;

      const result = await this.enhancedScheduleService.sendScheduleNotification(
        scheduleId,
        req.discordClient
      );

      if (result.success) {
        logger.info(`Manual notification sent for schedule ${scheduleId} by user ${userId}`);
        res.json({
          success: true,
          message: 'Notifications sent successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || 'Failed to send notifications'
        });
      }
    } catch (error) {
      logger.error('Error sending schedule notification:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to send notifications'
      });
    }
  }

  /**
   * Generate AI schedule for a specific month/year
   * POST /:month/:year/ai-generate
   */
  async generateAISchedule(req, res) {
    try {
      const { month, year } = req.params;
      const { employeeDaysOff = {} } = req.body;
      const userId = req.user.id; // Use the database ID directly from middleware

      // Get all employees and stores
      const employees = await this.enhancedScheduleService.prisma.user.findMany({
        where: { isActive: true }
      });

      const stores = await this.enhancedScheduleService.prisma.store.findMany({
        where: { isActive: true }
      });

      // Generate AI schedule
      const result = await this.enhancedScheduleService.generateAISchedule(
        parseInt(month) - 1, // Convert 1-based month to 0-based
        parseInt(year),
        employees,
        stores,
        userId,
        employeeDaysOff
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'AI schedule generated successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || 'Failed to generate AI schedule'
        });
      }
    } catch (error) {
      logger.error('Error generating AI schedule:', error.message);
      res.status(500).json({
        success: false,
        message: `Failed to generate AI schedule: ${error.message}`
      });
    }
  }

  /**
   * Mark schedule as ready
   * PUT /:month/:year/ready
   */
  async markScheduleAsReady(req, res) {
    try {
      const { month, year } = req.params;
      const userId = req.user.id;

      const result = await this.enhancedScheduleService.markScheduleAsReady(
        parseInt(month) - 1, // Convert 1-based month to 0-based
        parseInt(year),
        userId,
        req.discordClient
      );

      if (result.success) {
        logger.info(`Schedule marked as ready for ${month}/${year} by user ${userId}`);
        res.json({
          success: true,
          message: 'Schedule marked as ready successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || 'Failed to mark schedule as ready'
        });
      }
    } catch (error) {
      logger.error('Error marking schedule as ready:', error.message);
      res.status(500).json({
        success: false,
        message: `Failed to mark schedule as ready: ${error.message}`
      });
    }
  }

  /**
   * Mark schedule as not ready
   * DELETE /:month/:year/ready
   */
  async markScheduleAsNotReady(req, res) {
    try {
      const { month, year } = req.params;
      const userId = req.user.id;

      const result = await this.enhancedScheduleService.markScheduleAsNotReady(
        parseInt(month) - 1, // Convert 1-based month to 0-based
        parseInt(year),
        userId
      );

      if (result.success) {
        logger.info(`Schedule marked as not ready for ${month}/${year} by user ${userId}`);
        res.json({
          success: true,
          message: 'Schedule marked as not ready successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || 'Failed to mark schedule as not ready'
        });
      }
    } catch (error) {
      logger.error('Error marking schedule as not ready:', error.message);
      res.status(500).json({
        success: false,
        message: `Failed to mark schedule as not ready: ${error.message}`
      });
    }
  }
}

export default EnhancedScheduleController;
