/**
 * Enhanced Schedule Service
 * Handles all schedule-related business logic with Store integration
 */

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import ExcelJS from 'exceljs';
import logger from '../config/logger.js';

/**
 * Enhanced service for managing schedules with store assignments
 */
export class EnhancedScheduleService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Validates schedule data with store assignments
   * @param {Object} data - Schedule data
   * @returns {boolean} Validation result
   */
  async validateScheduleData({ month, year, assignments }) {
    if (!Number.isInteger(month) || month < 0 || month > 11) {
      throw new Error('Invalid month');
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new Error('Invalid year');
    }
    if (!assignments || !Array.isArray(assignments)) {
      throw new Error('Assignments data is required');
    }

    const employees = await this.prisma.user.findMany({ 
      where: { 
        isActive: true,
        role: { in: ['EMPLOYEE', 'ADMIN'] }
      }
    });
    const stores = await this.prisma.store.findMany({ where: { isActive: true } });
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Validate assignments
    for (const assignment of assignments) {
      if (!assignment.date || !assignment.storeId || !assignment.employeeId || assignment.hours === undefined) {
        throw new Error('Invalid assignment: missing required fields');
      }

      const assignmentDate = new Date(assignment.date);
      if (assignmentDate.getMonth() !== month || assignmentDate.getFullYear() !== year) {
        throw new Error('Assignment date is outside the specified month');
      }

      if (assignmentDate.getDay() === 0 && assignment.hours > 0) {
        throw new Error('Sundays must have 0 hours');
      }

      // Validate employee exists
      const employee = employees.find(e => e.id === assignment.employeeId);
      if (!employee) {
        throw new Error(`Employee with ID ${assignment.employeeId} not found`);
      }

      // Validate store exists and is active
      const store = stores.find(s => s.id === assignment.storeId);
      if (!store) {
        throw new Error(`Store with ID ${assignment.storeId} not found or inactive`);
      }

      // Validate hours
      if (assignment.hours < 0 || assignment.hours > 24) {
        throw new Error('Invalid hours: must be between 0 and 24');
      }
    }

    // Check for conflicts - same employee on same day
    const conflicts = new Map();
    for (const assignment of assignments) {
      if (assignment.hours > 0) { // Only check non-zero hour assignments
        const dateKey = assignment.date;
        const employeeId = assignment.employeeId;
        
        if (!conflicts.has(dateKey)) {
          conflicts.set(dateKey, new Set());
        }
        
        if (conflicts.get(dateKey).has(employeeId)) {
          const employee = employees.find(e => e.id === employeeId);
          const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : employeeId;
          throw new Error(`Employee ${employeeName} has multiple assignments on ${assignment.date}`);
        }
        
        conflicts.get(dateKey).add(employeeId);
      }
    }

    return true;
  }

  /**
   * Creates a new schedule with store assignments
   * @param {Object} data - Schedule data
   * @param {Client} client - Discord client
   * @param {string} userId - User ID
   * @returns {Object} Created schedule
   */
  async createSchedule(data, client, userId) {
    const { month, year, assignments } = data;
    await this.validateScheduleData({ month, year, assignments });

    const employee = await this.prisma.user.findUnique({ where: { clerkId: userId } });
    if (!employee) {
      throw new Error(`User with clerkId ${userId} not found`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const existingSchedule = await tx.schedule.findFirst({ 
        where: { month, year } 
      });
      if (existingSchedule) {
        throw new Error('Schedule for this month already exists');
      }

      const schedule = await tx.schedule.create({
        data: { 
          month, 
          year, 
          createdBy: employee.id
        }
      });

      // Create assignments
      const assignmentData = assignments.map(assignment => ({
        date: new Date(assignment.date),
        storeId: assignment.storeId,
        employeeId: assignment.employeeId,
        hours: assignment.hours,
        scheduleId: schedule.id
      }));

      await tx.assignment.createMany({
        data: assignmentData
      });

      // Don't send notifications for new schedules - only when marked as ready
      return schedule;
    });
  }

  /**
   * Creates a new schedule or updates existing one with store assignments
   * @param {Object} data - Schedule data
   * @param {Client} client - Discord client
   * @param {string} userId - User ID
   * @returns {Object} Created or updated schedule
   */
  async createOrUpdateSchedule(data, client, userId) {
    const { month, year, assignments } = data;
    await this.validateScheduleData({ month, year, assignments });

    const employee = await this.prisma.user.findUnique({ where: { clerkId: userId } });
    if (!employee) {
      throw new Error(`User with clerkId ${userId} not found`);
    }

    return await this.prisma.$transaction(async (tx) => {
      let schedule = await tx.schedule.findFirst({ 
        where: { month, year } 
      });

      if (schedule) {
        // Update existing schedule - replace all assignments
        await tx.assignment.deleteMany({
          where: { scheduleId: schedule.id }
        });

        // Create new assignments
        const assignmentData = assignments.map(assignment => ({
          date: new Date(assignment.date),
          storeId: assignment.storeId,
          employeeId: assignment.employeeId,
          hours: assignment.hours,
          scheduleId: schedule.id
        }));

        await tx.assignment.createMany({
          data: assignmentData
        });

        // Don't send notifications for updates - only for new schedules
        return schedule;
      } else {
        // Create new schedule
        schedule = await tx.schedule.create({
          data: { 
            month, 
            year, 
            createdBy: employee.id
          }
        });

        // Create assignments
        const assignmentData = assignments.map(assignment => ({
          date: new Date(assignment.date),
          storeId: assignment.storeId,
          employeeId: assignment.employeeId,
          hours: assignment.hours,
          scheduleId: schedule.id
        }));

        await tx.assignment.createMany({
          data: assignmentData
        });

        // Don't send notifications for new schedules - only when marked as ready
        return schedule;
      }
    });
  }

  /**
   * Gets all schedules with assignments
   * @returns {Object[]} All schedules
   */
  async getAllSchedules() {
    return await this.prisma.schedule.findMany({
      include: { 
        Creator: {
          select: { firstName: true, lastName: true }
        },
        Assignments: {
          include: {
            Store: true
          }
        }
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });
  }

  /**
   * Gets schedule by month and year with assignments
   * @param {number} month - Month (0-11)
   * @param {number} year - Year
   * @returns {Object} Schedule with assignments
   */
  async getScheduleByMonth(month, year) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { month, year },
      include: {
        Creator: {
          select: { firstName: true, lastName: true }
        },
        Assignments: {
          include: {
            Store: true
          },
          orderBy: { date: 'asc' }
        }
      }
    });

    if (!schedule) {
      return null;
    }

    // Group assignments by date and employee
    const assignmentsByDate = {};
    const employees = await this.prisma.user.findMany({ 
      where: { 
        isActive: true,
        role: { in: ['EMPLOYEE', 'ADMIN'] }
      }
    });
    const stores = await this.prisma.store.findMany({ where: { isActive: true } });

    schedule.Assignments.forEach(assignment => {
      const dateKey = assignment.date.toISOString().split('T')[0];
      if (!assignmentsByDate[dateKey]) {
        assignmentsByDate[dateKey] = {};
      }
      assignmentsByDate[dateKey][assignment.employeeId] = {
        storeId: assignment.storeId,
        storeName: assignment.Store.name,
        hours: assignment.hours
      };
    });

    return {
      ...schedule,
      assignmentsByDate,
      employees,
      stores
    };
  }

  /**
   * Updates a schedule with new assignments
   * @param {string} id - Schedule ID
   * @param {Object} data - Updated schedule data
   * @param {Client} client - Discord client
   * @param {string} userId - User ID
   * @returns {Object} Updated schedule
   */
  async updateSchedule(id, data, client, userId) {
    const { month, year, assignments } = data;
    await this.validateScheduleData({ month, year, assignments });

    const employee = await this.prisma.user.findUnique({ where: { clerkId: userId } });
    if (!employee) {
      throw new Error(`User with clerkId ${userId} not found`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const schedule = await tx.schedule.findUnique({
        where: { id },
        include: {
          Assignments: {
            include: {
              Employee: true,
              Store: true
            }
          }
        }
      });
      if (!schedule) {
        throw new Error('Schedule not found');
      }
      const previousAssignments = schedule.Assignments ? [...schedule.Assignments] : [];

      // Delete existing assignments
      await tx.assignment.deleteMany({
        where: { scheduleId: id }
      });

      // Update schedule
      const updatedSchedule = await tx.schedule.update({
        where: { id },
        data: {
          month,
          year,
          createdBy: employee.id
        }
      });

      // Create new assignments
      const assignmentData = assignments.map(assignment => ({
        date: new Date(assignment.date),
        storeId: assignment.storeId,
        employeeId: assignment.employeeId,
        hours: assignment.hours,
        scheduleId: id
      }));

      await tx.assignment.createMany({
        data: assignmentData
      });

      // Get the full schedule with assignments for notifications
      const fullSchedule = await tx.schedule.findUnique({
        where: { id },
        include: {
          Creator: true,
          Assignments: {
            include: {
              Employee: true,
              Store: true
            }
          }
        }
      });

      const changeSummary = this.calculateAssignmentDifferences(
        previousAssignments,
        fullSchedule.Assignments ?? []
      );

      // If schedule is marked as ready, send notifications about modifications
      if (schedule.isReady) {
        // Send notifications about schedule modifications
        await this.notifyUsers(fullSchedule, 'update', client, { changeSummary });
        
        // Create panel notifications for modifications
        await this.createPanelNotifications(fullSchedule, 'update');
      }

      return fullSchedule;
    });
  }

  /**
   * Updates a schedule by month and year
   * @param {number} month - Month (0-11)
   * @param {number} year - Year
   * @param {Object} data - Updated schedule data
   * @param {Client} client - Discord client
   * @param {string} userId - User ID
   * @returns {Object} Updated schedule
   */
  async updateScheduleByMonth(month, year, data, client, userId) {
    const { assignments } = data;
    await this.validateScheduleData({ month, year, assignments });

    const employee = await this.prisma.user.findUnique({ where: { clerkId: userId } });
    if (!employee) {
      throw new Error(`User with clerkId ${userId} not found`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // Find existing schedule by month and year
      const schedule = await tx.schedule.findFirst({
        where: { month, year },
        include: {
          Assignments: {
            include: {
              Employee: true,
              Store: true
            }
          }
        }
      });

      if (!schedule) {
        throw new Error(`Schedule for ${month + 1}/${year} not found`);
      }
      const previousAssignments = schedule.Assignments ? [...schedule.Assignments] : [];

      // Delete existing assignments
      await tx.assignment.deleteMany({
        where: { scheduleId: schedule.id }
      });

      // Update schedule
      const updatedSchedule = await tx.schedule.update({
        where: { id: schedule.id },
        data: {
          month,
          year,
          createdBy: employee.id
        }
      });

      // Create new assignments
      const assignmentData = assignments.map(assignment => ({
        date: new Date(assignment.date),
        storeId: assignment.storeId,
        employeeId: assignment.employeeId,
        hours: assignment.hours,
        scheduleId: schedule.id
      }));

      await tx.assignment.createMany({
        data: assignmentData
      });

      // Get the full schedule with assignments for notifications
      const fullSchedule = await tx.schedule.findUnique({
        where: { id: schedule.id },
        include: {
          Creator: true,
          Assignments: {
            include: {
              Employee: true,
              Store: true
            }
          }
        }
      });

      const changeSummary = this.calculateAssignmentDifferences(
        previousAssignments,
        fullSchedule.Assignments ?? []
      );

      // If schedule is marked as ready, send notifications about modifications
      if (schedule.isReady) {
        // Send notifications about schedule modifications
        await this.notifyUsers(fullSchedule, 'update', client, { changeSummary });
        
        // Create panel notifications for modifications
        await this.createPanelNotifications(fullSchedule, 'update');
      }

      return fullSchedule;
    });
  }

  /**
   * Deletes a schedule
   * @param {string} id - Schedule ID
   * @param {Client} client - Discord client
   * @returns {Object} Deletion result
   */
  async deleteSchedule(id, client) {
    const scheduleId = typeof id === 'number' ? id : Number(id);

    if (!Number.isInteger(scheduleId)) {
      throw new Error('Invalid schedule ID');
    }

    const scheduleDetails = await this.prisma.$transaction(async (tx) => {
      const schedule = await tx.schedule.findUnique({
        where: { id: scheduleId },
        include: {
          Creator: true,
          Assignments: {
            include: {
              Employee: true,
              Store: true
            }
          }
        }
      });

      if (!schedule) {
        throw new Error('Schedule not found');
      }

      await tx.assignment.deleteMany({ where: { scheduleId } });
      await tx.schedule.delete({ where: { id: scheduleId } });

      return schedule;
    });

    try {
      if (client) {
        await this.notifyUsers(scheduleDetails, 'delete', client);
      }
    } catch (error) {
      logger.error('Error notifying users about schedule deletion:', error.message);
    }

    try {
      await this.createPanelNotifications(scheduleDetails, 'delete');
    } catch (error) {
      logger.error('Error creating panel notifications for schedule deletion:', error.message);
    }

    return { message: 'Schedule deleted successfully' };
  }

  /**
   * Manually sends notifications about schedule changes
   * @param {string} scheduleId - Schedule ID
   * @param {Client} client - Discord client
   * @returns {Object} Notification result
   */
  async sendScheduleNotification(scheduleId, client) {
    try {
      // Convert scheduleId to integer if it's a string
      const id = typeof scheduleId === 'string' ? parseInt(scheduleId, 10) : scheduleId;
      
      if (isNaN(id)) {
        throw new Error('Invalid schedule ID');
      }

      const schedule = await this.prisma.schedule.findUnique({
        where: { id: id }
      });

      if (!schedule) {
        throw new Error('Schedule not found');
      }

      // Get employees count for summary
      const employees = await this.prisma.user.findMany({ 
        where: { 
          isActive: true,
          role: { in: ['EMPLOYEE', 'ADMIN'] }
        }
      });

      const employeesWithDiscord = employees.filter(emp => emp.discordId);
      const employeesWithoutDiscord = employees.filter(emp => !emp.discordId);

      await this.notifyUsers(schedule, 'update', client);
      
      logger.info(`Manual notification sent for schedule ${id}`, {
        totalEmployees: employees.length,
        withDiscord: employeesWithDiscord.length,
        withoutDiscord: employeesWithoutDiscord.length
      });

      return {
        success: true,
        message: `Notifications sent successfully to ${employeesWithDiscord.length} employees with Discord accounts`,
        summary: {
          totalEmployees: employees.length,
          notified: employeesWithDiscord.length,
          skipped: employeesWithoutDiscord.length
        }
      };
    } catch (error) {
      logger.error('Error sending manual notification:', error.message);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Notifies users about schedule changes
   * @param {Object} schedule - Schedule model instance
   * @param {string} action - Action type (create, update, delete)
   * @param {Client} client - Discord client
   */
  async notifyUsers(schedule, action, client, options = {}) {
    const { changeSummary } = options;
    const employees = await this.prisma.user.findMany({ 
      where: { 
        isActive: true,
        role: { in: ['EMPLOYEE', 'ADMIN'] }
      }
    });
    const monthName = new Date(schedule.year, schedule.month).toLocaleString('pl-PL', { month: 'long' });

    for (const employee of employees) {
      const employeeName = employee.firstName && employee.lastName 
        ? `${employee.firstName} ${employee.lastName}` 
        : employee.clerkId || employee.id;
      
      logger.info(`Processing notification for employee: ${employeeName} (ID: ${employee.id}, Discord ID: ${employee.discordId || 'NONE'})`);
      
      if (!employee.discordId) {
        logger.warn(`No Discord ID for employee: ${employeeName} (ID: ${employee.id})`);
        continue;
      }

      let embed;
      if (action === 'create') {
        embed = new EmbedBuilder()
          .setColor('#37ff00')
          .setTitle('Nowy grafik')
          .setDescription(`Nowy grafik na ${monthName} ${schedule.year} został utworzony.`)
          .setTimestamp();
      } else if (action === 'update') {
        const descriptionParts = [`Grafik na ${monthName} ${schedule.year} został zaktualizowany.`];
        if (changeSummary) {
          const summaryText = this.formatChangeSummary(changeSummary);
          if (summaryText) {
            descriptionParts.push('', summaryText);
          }
        }
        embed = new EmbedBuilder()
          .setColor('#00ffa6')
          .setTitle('Grafik zaktualizowany')
          .setDescription(descriptionParts.join('\n'))
          .setTimestamp();
      } else if (action === 'ready') {
        embed = new EmbedBuilder()
          .setColor('#00ff00')
          .setTitle('🎉 Grafik gotowy!')
          .setDescription(`Grafik na ${monthName} ${schedule.year} został oznaczony jako gotowy i jest dostępny do przeglądu!`)
          .setTimestamp();
      } else if (action === 'delete') {
        embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Grafik usunięty')
          .setDescription(`Grafik na ${monthName} ${schedule.year} został usunięty.`)
          .setTimestamp();
      }

      // Add buttons for create, update, and ready actions
      let components = [];
      if (action === 'create' || action === 'update' || action === 'ready') {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`timesheet_${schedule.id}_${employee.id}`)
            .setLabel('Pobierz godzinówkę')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`schedule_${schedule.id}_${employee.id}`)
            .setLabel('Sprawdź grafik')
            .setStyle(ButtonStyle.Secondary)
        );
        components = [row];
      }

      if (embed) {
        try {
          logger.info(`Attempting to fetch Discord user: ${employee.discordId}`);
          const user = await client.users.fetch(employee.discordId);
          logger.info(`Successfully fetched Discord user: ${user.username}#${user.discriminator || 'N/A'}`);
          
          logger.info(`Attempting to send DM to user: ${user.username}`);
          await user.send({ embeds: [embed], components });
          logger.info(`Successfully notified user ${employee.discordId} for action ${action}`);
        } catch (err) {
          // Handle different types of Discord API errors
          logger.error(`Discord API error for user ${employee.discordId}:`, {
            code: err.code,
            message: err.message,
            status: err.status,
            method: err.method,
            url: err.url
          });
          
          if (err.code === 50007) {
            logger.warn(`Cannot send DM to user ${employee.discordId} - user has DMs disabled`);
          } else if (err.code === 10013) {
            logger.warn(`User ${employee.discordId} not found in Discord`);
          } else if (err.code === 50001) {
            logger.warn(`User ${employee.discordId} - missing access`);
          } else if (err.code === 50013) {
            logger.warn(`User ${employee.discordId} - missing permissions`);
          } else {
            logger.error(`Failed to notify user ${employee.discordId} for action ${action}:`, err.message);
          }
        }
      }
    }
  }

  /**
   * Generates employee timesheet with store information
   * @param {string} scheduleId - Schedule ID
   * @param {string} employeeId - Employee ID
   * @returns {Buffer} Excel buffer
   */
  async generateEmployeeTimesheet(scheduleId, employeeId) {
    logger.info(`EnhancedScheduleService: Generating timesheet for scheduleId: ${scheduleId}, employeeId: ${employeeId}`);
    
    const schedule = await this.prisma.schedule.findUnique({ 
      where: { id: scheduleId },
      include: {
        Assignments: {
          where: { employeeId },
          include: { Store: true }
        }
      }
    });
    
    if (!schedule) {
      logger.error(`EnhancedScheduleService: Schedule not found with ID: ${scheduleId}`);
      throw new Error('Schedule not found');
    }

    logger.info(`EnhancedScheduleService: Found schedule: ${schedule.month}/${schedule.year}`);
    
    // Try to find by ID first, then by clerkId if not found
    let employee = await this.prisma.user.findUnique({ where: { id: employeeId } });
    if (!employee) {
      logger.info(`EnhancedScheduleService: User not found by ID, trying clerkId: ${employeeId}`);
      employee = await this.prisma.user.findUnique({ where: { clerkId: employeeId } });
    }
    
    if (!employee) {
      logger.error(`EnhancedScheduleService: User not found with ID or clerkId: ${employeeId}`);
      throw new Error('User not found');
    }
    
    logger.info(`EnhancedScheduleService: Found employee: ${employee.firstName} ${employee.lastName}`);
    logger.info(`EnhancedScheduleService: Found ${schedule.Assignments.length} assignments for employee`);

    if (schedule.Assignments.length === 0) {
      logger.warn(`EnhancedScheduleService: No assignments found for employee ${employeeId} in schedule ${scheduleId}`);
      throw new Error(`No assignments found for employee ${employeeId}`);
    }

    const daysInMonth = new Date(schedule.year, schedule.month + 1, 0).getDate();
    const monthName = new Date(schedule.year, schedule.month).toLocaleString('pl-PL', { month: 'long' });
    const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    
    logger.info(`EnhancedScheduleService: Creating Excel workbook for ${daysInMonth} days`);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Lista obecności');
    
    logger.info(`EnhancedScheduleService: Excel worksheet created`);

    worksheet.pageSetup = {
      margins: {
        left: 0.7,
        right: 0.7,
        top: 0.25,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3
      }
    };

    const grayFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'D3D3D3' }
    };

    // Apply global font
    logger.info(`EnhancedScheduleService: Applying global font`);
    workbook.eachSheet(sheet => {
      sheet.eachRow(row => {
        row.font = { name: 'Tahoma', size: 11 };
      });
    });
    
    logger.info(`EnhancedScheduleService: Global font applied`);

    // Header and employee details
    logger.info(`EnhancedScheduleService: Setting up header cells`);
    worksheet.getCell('A1').value = 'Rok';
    worksheet.getCell('A1').fill = grayFill;
    logger.info(`EnhancedScheduleService: Set A1 cell`);
    
    worksheet.mergeCells('B1:C1');
    worksheet.getCell('B1').value = schedule.year;
    worksheet.getCell('B1').alignment = { horizontal: 'center', vertical: 'middle' };
    logger.info(`EnhancedScheduleService: Set B1 cell with year: ${schedule.year}`);
    
    worksheet.mergeCells('D1:F2');
    worksheet.getCell('D1').value = 'Imię i Nazwisko';
    worksheet.getCell('D1').fill = grayFill;
    logger.info(`EnhancedScheduleService: Set D1 cell`);
    
    worksheet.mergeCells('G1:I2');
    const employeeName = employee.firstName && employee.lastName 
      ? `${employee.firstName} ${employee.lastName}` 
      : employee.email;
    worksheet.getCell('G1').value = employeeName;
    worksheet.getCell('G1').alignment = { horizontal: 'center', vertical: 'middle' };
    logger.info(`EnhancedScheduleService: Set G1 cell with employee name: ${employeeName}`);

    logger.info(`EnhancedScheduleService: Setting up A2 cell`);
    worksheet.getCell('A2').value = 'Miesiąc';
    worksheet.getCell('A2').fill = grayFill;
    logger.info(`EnhancedScheduleService: Set A2 cell`);
    
    worksheet.mergeCells('B2:C2');
    worksheet.getCell('B2').value = capitalizedMonthName;
    worksheet.getCell('B2').alignment = { horizontal: 'center', vertical: 'middle' };
    logger.info(`EnhancedScheduleService: Set B2 cell with month: ${capitalizedMonthName}`);

    worksheet.getCell('A3').value = 'Norma';
    worksheet.getCell('A3').fill = grayFill;
    worksheet.mergeCells('B3:C3');
    worksheet.getCell('B3').value = '';
    worksheet.mergeCells('D3:F3');
    worksheet.getCell('D3').value = 'Stanowisko';
    worksheet.getCell('D3').fill = grayFill;
    worksheet.mergeCells('G3:I3');
    worksheet.getCell('G3').value = 'Sprzedawca';
    worksheet.getCell('G3').alignment = { horizontal: 'center', vertical: 'middle' };

    // Table headers (Row 4)
    worksheet.getCell('A4').value = 'Dzień m-ca';
    worksheet.getCell('A4').fill = grayFill;
    worksheet.mergeCells('B4:C4');
    worksheet.getCell('B4').value = 'Rozpoczęcie pracy';
    worksheet.getCell('B4').fill = grayFill;
    worksheet.mergeCells('D4:E4');
    worksheet.getCell('D4').value = 'Zakończenie pracy';
    worksheet.getCell('D4').fill = grayFill;
    worksheet.getCell('F4').value = 'Ilość godzin';
    worksheet.getCell('F4').fill = grayFill;
    worksheet.mergeCells('G4:H4');
    worksheet.getCell('G4').value = 'Notatka';
    worksheet.getCell('G4').fill = grayFill;
    worksheet.getCell('I4').value = 'Podpis';
    worksheet.getCell('I4').fill = grayFill;

    // Style row 4
    const row4 = worksheet.getRow(4);
    row4.height = 40;

    // Set other header row heights
    for (let row = 1; row <= 3; row++) {
      worksheet.getRow(row).height = 20.8;
    }

    // Create assignments lookup
    const assignmentsByDate = {};
    schedule.Assignments.forEach(assignment => {
      const date = new Date(assignment.date);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      assignmentsByDate[dateKey] = {
        hours: assignment.hours,
        storeName: assignment.Store.name
      };
    });

    // Table data (starting Row 5)
    for (let day = 1; day <= daysInMonth; day++) {
      const row = 4 + day;
      const date = new Date(schedule.year, schedule.month, day);
      const dateKey = `${schedule.year}-${String(schedule.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSunday = date.getDay() === 0;
      const isSaturday = date.getDay() === 6;
      const assignment = assignmentsByDate[dateKey];
      const isDayOff = !assignment || assignment.hours === 0;

      worksheet.getRow(row).height = 20.8;
      worksheet.getRow(row).font = { name: 'Tahoma', size: 11 };

      worksheet.mergeCells(`B${row}:C${row}`);
      worksheet.mergeCells(`D${row}:E${row}`);
      worksheet.mergeCells(`G${row}:H${row}`);

      worksheet.getCell(`A${row}`).value = day;
      worksheet.getCell(`B${row}`).value = '';
      worksheet.getCell(`D${row}`).value = '';
      worksheet.getCell(`F${row}`).value = '';
      worksheet.getCell(`G${row}`).value = '';
      worksheet.getCell(`I${row}`).value = '';

      // Apply red fill for days off, blue for Saturdays, red for Sundays only if they are days off
      if (isDayOff) {
        for (let col = 1; col <= 9; col++) {
          worksheet.getCell(row, col).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0000' } // Red for days off
          };
          worksheet.getCell(row, col).font = { name: 'Tahoma', size: 11, color: { argb: '000000' } }; // Black font
        }
      } else if (isSaturday) {
        for (let col = 1; col <= 9; col++) {
          worksheet.getCell(row, col).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '00B0F0' } // Blue for Saturdays
          };
          worksheet.getCell(row, col).font = { name: 'Tahoma', size: 11, color: { argb: '000000' } }; // Black font
        }
      } else if (isSunday) {
        for (let col = 1; col <= 9; col++) {
          worksheet.getCell(row, col).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0000' } // Red for Sundays (only if working)
          };
          worksheet.getCell(row, col).font = { name: 'Tahoma', size: 11, color: { argb: '000000' } }; // Black font
        }
      }
    }

    // Total hours row
    const totalRow = 5 + daysInMonth;
    
    worksheet.getRow(totalRow).height = 29;
    worksheet.getRow(totalRow).font = { name: 'Tahoma', size: 11, bold: true };
    worksheet.mergeCells(`B${totalRow}:E${totalRow}`);
    worksheet.getCell(`B${totalRow}`).value = 'Razem';
    worksheet.getCell(`B${totalRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell(`F${totalRow}`).value = '';
    worksheet.mergeCells(`G${totalRow}:H${totalRow}`);
    worksheet.getCell(`G${totalRow}`).value = '';
    worksheet.getCell(`I${totalRow}`).value = '';

    // Set column widths
    worksheet.getColumn(1).width = 74 / 7;
    worksheet.getColumn(2).width = 46 / 7;
    worksheet.getColumn(3).width = 46 / 7;
    worksheet.getColumn(4).width = 46 / 7;
    worksheet.getColumn(5).width = 46 / 7;
    worksheet.getColumn(6).width = 74 / 7;
    worksheet.getColumn(7).width = 74 / 7;
    worksheet.getColumn(8).width = 74 / 7;
    worksheet.getColumn(9).width = 121 / 7;

    // Apply borders to table
    for (let row = 4; row <= 4 + daysInMonth; row++) {
      for (let col = 1; col <= 9; col++) {
        const cell = worksheet.getCell(row, col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }

    // Apply borders to total row (columns 2-6 only)
    for (let col = 2; col <= 6; col++) {
      const cell = worksheet.getCell(totalRow, col);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    }

    // Apply borders and styling to header cells
    const headerCells = ['A1', 'B1', 'D1', 'G1', 'A2', 'B2', 'A3', 'B3', 'D3', 'G3'];
    headerCells.forEach(cellRef => {
      const cell = worksheet.getCell(cellRef);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { name: 'Tahoma', size: 11 };
    });

    row4.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.font = { name: 'Tahoma', size: 11 };
    });

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Exports schedule to Excel with store assignments
   * @param {string} id - Schedule ID
   * @returns {Buffer} Excel buffer
   */
  async exportSchedule(id) {
    const schedule = await this.prisma.schedule.findUnique({ 
      where: { id },
      include: {
        Assignments: {
          include: { Store: true }
        }
      }
    });
    
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const employees = await this.prisma.user.findMany({ 
      where: { 
        isActive: true,
        role: { in: ['EMPLOYEE', 'ADMIN'] }
      }
    });
    const daysInMonth = new Date(schedule.year, schedule.month + 1, 0).getDate();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Grafik ${schedule.month + 1}-${schedule.year}`);

    // Create assignments lookup - convert to old format
    const shifts = {};
    schedule.Assignments.forEach(assignment => {
      const date = new Date(assignment.date);
      const day = date.getDate();
      
      if (!shifts[assignment.employeeId]) {
        shifts[assignment.employeeId] = {};
      }
      
      // Convert store name to old format codes
      const storeCode = this.getStoreCode(assignment.Store.name);
      shifts[assignment.employeeId][day] = storeCode;
    });

    const monthName = new Date(schedule.year, schedule.month).toLocaleString('pl-PL', { month: 'long' });
    const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const headers = [`${capitalizedMonthName} ${schedule.year}`, ...Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString())];
    worksheet.addRow(headers);

    // Add employee shift rows
    for (const employee of employees) {
      const employeeName = employee.firstName && employee.lastName 
        ? `${employee.firstName} ${employee.lastName}` 
        : employee.clerkId || employee.id;
      const row = [employeeName];
      for (let day = 1; day <= daysInMonth; day++) {
        row.push(shifts[employee.id]?.[day] || 'X');
      }
      worksheet.addRow(row);
    }

    // Add legend
    worksheet.addRow([]);
    const legendStartRow = worksheet.addRow(['Legenda']).rowNumber;
    const legendData = [
      ['Wolne', 'X'],
      ['Pod Telefonem', '/'],
      ['Biuro', 'BIU'],
      ['Muranów', 'MUR'],
      ['Mokotów', 'MOK'],
      ['Olsztyn Śródmieście', 'OŚ'],
      ['Olsztyn Jaroty', 'OJ'],
      ['Puławska', 'PŁ']
    ];
    legendData.forEach(data => worksheet.addRow(data));

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'D3D3D3' }
    };

    // Set column widths
    worksheet.getColumn(1).width = 20;
    for (let col = 2; col <= daysInMonth + 1; col++) {
      worksheet.getColumn(col).width = 6;
    }

    // Apply weekend formatting
    const dayColumns = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(schedule.year, schedule.month, day);
      dayColumns.push({ col: day + 1, isSaturday: date.getDay() === 6, isSunday: date.getDay() === 0 });
    }

    const tableRows = employees.length + 1;
    for (let row = 1; row <= tableRows; row++) {
      for (let col = 1; col <= daysInMonth + 1; col++) {
        const cell = worksheet.getCell(row, col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        if (row === 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (col > 1) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        if (row === 1 && col > 1) {
          const dayInfo = dayColumns[col - 2];
          if (dayInfo.isSunday) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF0000' }
            };
          } else if (dayInfo.isSaturday) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: '4df9ff' }
            };
          }
        } else if (row > 1 && col > 1) {
          const dayInfo = dayColumns[col - 2];
          if (cell.value === 'X') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF0000' }
            };
          } else if (dayInfo.isSaturday) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: '4df9ff' }
            };
          } else if (dayInfo.isSunday) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF0000' }
            };
          }
        }
      }
    }

    // Style legend
    worksheet.getRow(legendStartRow).font = { bold: true };
    for (let row = legendStartRow + 1; row <= legendStartRow + legendData.length; row++) {
      for (let col = 1; col <= 2; col++) {
        const cell = worksheet.getCell(row, col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Converts store name to old format code
   * @param {string} storeName - Store name
   * @returns {string} Store code
   */
  getStoreCode(storeName) {
    const storeCodeMap = {
      'Olsztyn Śródmieście': 'OŚ',
      'Olsztyn Jaroty': 'OJ',
      'Mokotów': 'MOK',
      'Muranów': 'MUR',
      'Puławska': 'PŁ',
      'Warszawa Mokotów': 'MOK',
      'Warszawa Muranów': 'MUR',
      'Warszawa Puławska': 'PŁ',
      'Biuro': 'BIU',
      'Pod Telefonem': '/'
    };
    
    return storeCodeMap[storeName] || 'X';
  }

  /**
   * Gets monthly summary for all employees
   * @param {number} month - Month (0-11)
   * @param {number} year - Year
   * @returns {Object} Monthly summary
   */
  async getMonthlySummary(month, year) {
    const schedule = await this.getScheduleByMonth(month, year);
    if (!schedule) {
      return null;
    }

    const employees = await this.prisma.user.findMany({ 
      where: { 
        isActive: true,
        role: { in: ['EMPLOYEE', 'ADMIN'] }
      }
    });
    const stores = await this.prisma.store.findMany({ where: { isActive: true } });

    // Calculate employee hours
    const employeeHours = {};
    const storeHours = {};

    schedule.Assignments.forEach(assignment => {
      // Employee hours
      if (!employeeHours[assignment.employeeId]) {
        employeeHours[assignment.employeeId] = 0;
      }
      employeeHours[assignment.employeeId] += assignment.hours;

      // Store hours
      if (!storeHours[assignment.storeId]) {
        storeHours[assignment.storeId] = 0;
      }
      storeHours[assignment.storeId] += assignment.hours;
    });

    return {
      schedule,
      employeeHours,
      storeHours,
      employees,
      stores,
      totalAssignedHours: Object.values(employeeHours).reduce((sum, hours) => sum + hours, 0)
    };
  }


  /**
   * Updates a specific assignment in a schedule
   * @param {string} assignmentId - Assignment ID to update
   * @param {Object} data - Updated assignment data
   * @param {string} userId - User ID making the request
   * @param {Client} client - Discord client (optional)
   * @returns {Object} Updated assignment
   */
  async updateAssignment(assignmentId, data, userId, client = null) {
    try {
      const { storeId, hours } = data;

      if (!storeId) {
        throw new Error('Store ID is required');
      }

      // Verify the assignment exists
      const existingAssignment = await this.prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: { Store: true, Employee: true }
      });

      if (!existingAssignment) {
        throw new Error('Assignment not found');
      }

      // Get store hours if hours not provided
      let assignmentHours = hours;
      if (!assignmentHours) {
        const store = await this.prisma.store.findUnique({
          where: { id: storeId }
        });
        
        if (!store) {
          throw new Error('Store not found');
        }

        const assignmentDate = new Date(existingAssignment.date);
        const dayOfWeek = assignmentDate.getUTCDay();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];
        
        assignmentHours = store.workingHoursPerDay[dayName] || 0;
      }

      // Update the assignment
      const updatedAssignment = await this.prisma.assignment.update({
        where: { id: assignmentId },
        data: {
          storeId,
          hours: assignmentHours
        },
        include: {
          Store: true,
          Employee: true,
          Schedule: {
            include: {
              Creator: true,
              Assignments: {
                include: {
                  Employee: true,
                  Store: true
                }
              }
            }
          }
        }
      });

      const changeSummary = {
        added: [],
        removed: [],
        updated: [{
          previous: existingAssignment,
          next: updatedAssignment
        }]
      };

      // If schedule is marked as ready, send notifications about modifications
      if (updatedAssignment.Schedule.isReady) {
        // Send Discord notifications if client is available
        if (client) {
          await this.notifyUsers(updatedAssignment.Schedule, 'update', client, { changeSummary });
        }
        
        // Create panel notifications for modifications
        await this.createPanelNotifications(updatedAssignment.Schedule, 'update');
      }

      logger.info(`Assignment updated: ${assignmentId} by user ${userId}`);

      return updatedAssignment;
    } catch (error) {
      logger.error('Error updating assignment:', error.message);
      throw error;
    }
  }

  /**
   * Delete a specific assignment from a schedule
   * @param {number} month - Month (1-12)
   * @param {number} year - Year
   * @param {string} assignmentId - Assignment ID to delete
   * @param {string} userId - User ID making the request
   * @param {Client} client - Discord client (optional)
   * @returns {Promise<Object>} Result object
   */
  async deleteAssignment(month, year, assignmentId, userId, discordClient = null) {
    const prisma = this.prisma;
    
    try {
      // Find the schedule for the given month/year
      const schedule = await prisma.schedule.findFirst({
        where: {
          month: month,
          year: year
        },
        include: {
          Assignments: true
        }
      });

      if (!schedule) {
        return {
          success: false,
          message: 'Schedule not found for the specified month and year'
        };
      }

      // Check if assignment exists
      const assignment = await prisma.assignment.findUnique({
        where: {
          id: assignmentId
        },
        include: {
          Store: true,
          Employee: true
        }
      });

      if (!assignment) {
        return {
          success: false,
          message: 'Assignment not found'
        };
      }

      // Check if assignment belongs to this schedule
      if (assignment.scheduleId !== schedule.id) {
        return {
          success: false,
          message: 'Assignment does not belong to this schedule'
        };
      }

      const changeSummary = {
        added: [],
        removed: assignment ? [assignment] : [],
        updated: []
      };

      // Delete the assignment
      await prisma.assignment.delete({
        where: {
          id: assignmentId
        }
      });

      // Get the full schedule with assignments for notifications
      const fullSchedule = await prisma.schedule.findUnique({
        where: { id: schedule.id },
        include: {
          Creator: true,
          Assignments: {
            include: {
              Employee: true,
              Store: true
            }
          }
        }
      });

      // If schedule is marked as ready, send notifications about modifications
      if (schedule.isReady) {
        // Send Discord notifications if client is available
        if (discordClient) {
          await this.notifyUsers(fullSchedule, 'update', discordClient, { changeSummary });
        }
        
        // Create panel notifications for modifications
        await this.createPanelNotifications(fullSchedule, 'update');
      }

      logger.info(`Assignment ${assignmentId} deleted from schedule ${schedule.id} by user ${userId}`);

      return {
        success: true,
        message: 'Assignment deleted successfully',
        data: {
          assignmentId: assignmentId,
          scheduleId: schedule.id
        }
      };

    } catch (error) {
      logger.error('Error deleting assignment:', error.message);
      return {
        success: false,
        message: 'Failed to delete assignment'
      };
    }
  }

  /**
   * Generate AI schedule for a specific month/year
   * @param {number} month - Month (0-11)
   * @param {number} year - Year
   * @param {Array} employees - List of employees
   * @param {Array} stores - List of stores
   * @param {string} userId - User ID making the request
   * @returns {Promise<Object>} Result object
   */
  async generateAISchedule(month, year, employees, stores, userId, employeeDaysOff = {}) {
    try {
      logger.info(`Generating AI schedule for ${month}/${year} by user ${userId}`);
      logger.info(`Employees count: ${employees.length}, Stores count: ${stores.length}`);
      
      // Import AIScheduleService
      const { AIScheduleService } = await import('./AIScheduleService.js');
      const aiService = new AIScheduleService(this.prisma);

      // Convert employeeDaysOff to preferences format
      const preferences = {};
      Object.keys(employeeDaysOff).forEach(employeeId => {
        const daysOff = employeeDaysOff[employeeId];
        const dateStrings = daysOff.map(day => {
          const date = new Date(Date.UTC(year, month, day));
          return date.toISOString().split('T')[0];
        });
        preferences[employeeId] = {
          daysOff: dateStrings
        };
      });

      // Generate AI schedule
      const aiResult = await aiService.generateSchedule({
        month,
        year,
        employees,
        stores,
        preferences,
        constraints: {
          maxHoursPerEmployee: 40,
          minHoursPerEmployee: 20,
          preferEvenDistribution: true,
          skipSundays: true
        }
      });

      logger.info(`AI generated ${aiResult.assignments.length} assignments`);

      // Create or update schedule with AI-generated assignments
      logger.info(`Looking for existing schedule: month=${month}, year=${year}`);
      const existingSchedule = await this.prisma.schedule.findFirst({
        where: { month, year } // Use 0-based month as stored in database
      });
      
      if (existingSchedule) {
        logger.info(`Found existing schedule: ID=${existingSchedule.id}, month=${existingSchedule.month}, year=${existingSchedule.year}`);
      } else {
        logger.info('No existing schedule found, will create new one');
      }

      if (existingSchedule) {
        // Update existing schedule
        await this.prisma.assignment.deleteMany({
          where: { scheduleId: existingSchedule.id }
        });

        const assignmentData = aiResult.assignments
          .filter(assignment => assignment.shiftType === 'STORE' && assignment.storeId) // Only store assignments for now
          .map(assignment => ({
            date: new Date(assignment.date),
            storeId: assignment.storeId,
            employeeId: assignment.employeeId,
            hours: assignment.hours,
            scheduleId: existingSchedule.id
          }));

        logger.info(`Filtered to ${assignmentData.length} STORE assignments for database`);

        await this.prisma.assignment.createMany({
          data: assignmentData
        });

        logger.info(`AI schedule updated for ${month + 1}/${year} by user ${userId}`);
        logger.info(`Created ${assignmentData.length} assignments in database`);

        return {
          success: true,
          message: 'AI schedule updated successfully',
          data: {
            scheduleId: existingSchedule.id,
            assignments: aiResult.assignments,
            generatedAt: aiResult.generatedAt,
            algorithm: aiResult.algorithm,
            confidence: aiResult.confidence
          }
        };
      } else {
        // Create new schedule
        const schedule = await this.prisma.schedule.create({
          data: {
            month, // Use 0-based month as stored in database
            year,
            createdBy: userId
          }
        });

        const assignmentData = aiResult.assignments
          .filter(assignment => assignment.shiftType === 'STORE' && assignment.storeId) // Only store assignments for now
          .map(assignment => ({
            date: new Date(assignment.date),
            storeId: assignment.storeId,
            employeeId: assignment.employeeId,
            hours: assignment.hours,
            scheduleId: schedule.id
          }));

        await this.prisma.assignment.createMany({
          data: assignmentData
        });

        logger.info(`AI schedule created for ${month + 1}/${year} by user ${userId}`);

        return {
          success: true,
          message: 'AI schedule created successfully',
          data: {
            scheduleId: schedule.id,
            assignments: aiResult.assignments,
            generatedAt: aiResult.generatedAt,
            algorithm: aiResult.algorithm,
            confidence: aiResult.confidence
          }
        };
      }

    } catch (error) {
      logger.error('Error generating AI schedule:', error.message);
      logger.error('Error details:', {
        message: error.message,
        stack: error.stack,
        month,
        year,
        userId
      });
      return {
        success: false,
        message: 'Failed to generate AI schedule'
      };
    }
  }

  /**
   * Mark schedule as ready and send notifications
   * @param {number} month - Month (0-based)
   * @param {number} year - Year
   * @param {string} userId - User ID who is marking as ready
   * @param {Client} client - Discord client
   * @returns {Object} Result object
   */
  async markScheduleAsReady(month, year, userId, client) {
    try {
      // Find the schedule
      const schedule = await this.prisma.schedule.findFirst({
        where: {
          month,
          year
        },
        include: {
          Creator: true,
          Assignments: {
            include: {
              Employee: true,
              Store: true
            }
          }
        }
      });

      if (!schedule) {
        return {
          success: false,
          message: 'Schedule not found'
        };
      }

      // Check if user has permission (only creator or admin)
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      if (schedule.createdBy !== userId && user.role !== 'ADMIN') {
        return {
          success: false,
          message: 'Only the schedule creator or admin can mark it as ready'
        };
      }

      // Update schedule to ready
      const updatedSchedule = await this.prisma.schedule.update({
        where: { id: schedule.id },
        data: { isReady: true },
        include: {
          Creator: true,
          Assignments: {
            include: {
              Employee: true,
              Store: true
            }
          }
        }
      });

      // Send notifications about new ready schedule
      await this.notifyUsers(updatedSchedule, 'ready', client);

      // Create panel notifications for all employees
      await this.createPanelNotifications(updatedSchedule, 'ready');

      logger.info(`Schedule marked as ready: ${month + 1}/${year} by user ${userId}`);

      return {
        success: true,
        message: 'Schedule marked as ready successfully',
        data: updatedSchedule
      };

    } catch (error) {
      logger.error('Error marking schedule as ready:', error.message);
      return {
        success: false,
        message: 'Failed to mark schedule as ready'
      };
    }
  }

  /**
   * Mark schedule as not ready
   * @param {number} month - Month (0-based)
   * @param {number} year - Year
   * @param {string} userId - User ID who is marking as not ready
   * @returns {Object} Result object
   */
  async markScheduleAsNotReady(month, year, userId) {
    try {
      // Find the schedule
      const schedule = await this.prisma.schedule.findFirst({
        where: {
          month,
          year
        },
        include: {
          Creator: true
        }
      });

      if (!schedule) {
        return {
          success: false,
          message: 'Schedule not found'
        };
      }

      // Check if user has permission (only creator or admin)
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      if (schedule.createdBy !== userId && user.role !== 'ADMIN') {
        return {
          success: false,
          message: 'Only the schedule creator or admin can mark it as not ready'
        };
      }

      // Update schedule to not ready
      const updatedSchedule = await this.prisma.schedule.update({
        where: { id: schedule.id },
        data: { isReady: false },
        include: {
          Creator: true,
          Assignments: {
            include: {
              Employee: true,
              Store: true
            }
          }
        }
      });

      logger.info(`Schedule marked as not ready: ${month + 1}/${year} by user ${userId}`);

      return {
        success: true,
        message: 'Schedule marked as not ready successfully',
        data: updatedSchedule
      };

    } catch (error) {
      logger.error('Error marking schedule as not ready:', error.message);
      return {
        success: false,
        message: 'Failed to mark schedule as not ready'
      };
    }
  }

  calculateAssignmentDifferences(previousAssignments = [], nextAssignments = []) {
    const toKey = (assignment) => {
      if (!assignment) {
        return '';
      }
      const date = assignment.date instanceof Date ? assignment.date : new Date(assignment.date);
      const dateKey = Number.isNaN(date.getTime())
        ? ''
        : date.toISOString().split('T')[0];
      return `${assignment.employeeId || ''}__${dateKey}`;
    };

    const previousMap = new Map();
    previousAssignments.forEach((assignment) => {
      const key = toKey(assignment);
      if (key) {
        previousMap.set(key, assignment);
      }
    });

    const nextMap = new Map();
    nextAssignments.forEach((assignment) => {
      const key = toKey(assignment);
      if (key) {
        nextMap.set(key, assignment);
      }
    });

    const added = [];
    const updated = [];
    const removed = [];

    nextMap.forEach((assignment, key) => {
      const previous = previousMap.get(key);
      if (!previous) {
        added.push(assignment);
        return;
      }

      const storeChanged = previous.storeId !== assignment.storeId;
      const hoursChanged = previous.hours !== assignment.hours;

      if (storeChanged || hoursChanged) {
        updated.push({
          previous,
          next: assignment
        });
      }
    });

    previousMap.forEach((assignment, key) => {
      if (!nextMap.has(key)) {
        removed.push(assignment);
      }
    });

    return {
      added,
      removed,
      updated
    };
  }

  formatChangeSummary(changeSummary) {
    if (!changeSummary) {
      return '';
    }

    const added = changeSummary.added ?? [];
    const removed = changeSummary.removed ?? [];
    const updated = changeSummary.updated ?? [];

    if (added.length === 0 && removed.length === 0 && updated.length === 0) {
      return '';
    }

    const summaryLines = [];
    const totals = [];

    if (added.length > 0) {
      totals.push(`dodane ${added.length}`);
    }
    if (updated.length > 0) {
      totals.push(`zmienione ${updated.length}`);
    }
    if (removed.length > 0) {
      totals.push(`usunięte ${removed.length}`);
    }

    if (added.length > 0) {
      summaryLines.push('**✚ Dodane:**');
      added.slice(0, 5).forEach((assignment) => {
        summaryLines.push(this.formatAddedAssignment(assignment));
      });
      if (added.length > 5) {
        summaryLines.push(`… +${added.length - 5} kolejnych dodanych zmian`);
      }
    }

    if (updated.length > 0) {
      summaryLines.push('');
      summaryLines.push('**🔄 Zaktualizowane:**');
      updated.slice(0, 5).forEach(({ previous, next }) => {
        summaryLines.push(this.formatUpdatedAssignment(previous, next));
      });
      if (updated.length > 5) {
        summaryLines.push(`… +${updated.length - 5} kolejnych zmian`);
      }
    }

    if (removed.length > 0) {
      summaryLines.push('');
      summaryLines.push('**❌ Usunięte:**');
      removed.slice(0, 5).forEach((assignment) => {
        summaryLines.push(this.formatRemovedAssignment(assignment));
      });
      if (removed.length > 5) {
        summaryLines.push(`… +${removed.length - 5} kolejnych usunięć`);
      }
    }

    return summaryLines.join('\n');
  }

  formatAddedAssignment(assignment) {
    if (!assignment) {
      return '';
    }
    const dateLabel = this.formatDateWithDay(assignment.date);
    const employeeName = this.getEmployeeDisplayName(assignment);
    const storeName = this.getStoreDisplayName(assignment);
    const hours = assignment.hours ?? 0;
    return `✚ **${dateLabel}** – **${employeeName}**: ${storeName} (${hours}h)`;
  }

  formatRemovedAssignment(assignment) {
    if (!assignment) {
      return '';
    }
    const dateLabel = this.formatDateWithDay(assignment.date);
    const employeeName = this.getEmployeeDisplayName(assignment);
    const storeName = this.getStoreDisplayName(assignment);
    const hours = assignment.hours ?? 0;
    return `❌ **${dateLabel}** – **${employeeName}**: ${storeName} (${hours}h)`;
  }

  formatUpdatedAssignment(previousAssignment, nextAssignment) {
    const reference = nextAssignment ?? previousAssignment;
    if (!reference) {
      return '';
    }
    const dateLabel = this.formatDateWithDay(reference.date);
    const employeeName = this.getEmployeeDisplayName(nextAssignment, previousAssignment);
    const oldStoreName = this.getStoreDisplayName(previousAssignment, nextAssignment);
    const newStoreName = this.getStoreDisplayName(nextAssignment, previousAssignment);
    const oldHours = previousAssignment?.hours ?? 0;
    const newHours = nextAssignment?.hours ?? 0;
    return `🔄 **${dateLabel}** – **${employeeName}**: ${oldStoreName} (${oldHours}h) → ${newStoreName} (${newHours}h)`;
  }

  getEmployeeDisplayName(primaryAssignment, fallbackAssignment) {
    const employee = primaryAssignment?.Employee || fallbackAssignment?.Employee;
    if (employee?.firstName && employee?.lastName) {
      return `${employee.firstName} ${employee.lastName}`;
    }
    return (
      employee?.email ||
      employee?.clerkId ||
      primaryAssignment?.employeeId ||
      fallbackAssignment?.employeeId ||
      'Pracownik'
    );
  }

  getStoreDisplayName(primaryAssignment, fallbackAssignment) {
    const store = primaryAssignment?.Store || fallbackAssignment?.Store;
    if (store?.name) {
      return store.name;
    }
    return (
      primaryAssignment?.storeName ||
      fallbackAssignment?.storeName ||
      primaryAssignment?.storeId ||
      fallbackAssignment?.storeId ||
      'Sklep'
    );
  }

  formatDateWithDay(dateInput) {
    if (!dateInput) {
      return '';
    }
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const dayNumber = date.getUTCDate();
    const weekday = date.toLocaleDateString('pl-PL', { weekday: 'long', timeZone: 'UTC' });
    const monthNameRaw = date.toLocaleDateString('pl-PL', { month: 'long', timeZone: 'UTC' });
    const monthName = monthNameRaw
      ? `${monthNameRaw.charAt(0).toUpperCase()}${monthNameRaw.slice(1)}`
      : '';
    return `${dayNumber} ${monthName} (${weekday})`;
  }

  /**
   * Create panel notifications for schedule events
   * @param {Object} schedule - Schedule object
   * @param {string} action - Action type (ready, update, etc.)
   */
  async createPanelNotifications(schedule, action) {
    try {
      const employees = await this.prisma.user.findMany({
        where: {
          isActive: true,
          role: { in: ['EMPLOYEE', 'ADMIN'] }
        }
      });

      const monthName = new Date(schedule.year, schedule.month).toLocaleString('pl-PL', { month: 'long' });
      
      let title, message, type;
      
      switch (action) {
        case 'ready':
          title = 'Nowy grafik gotowy';
          message = `Grafik na ${monthName} ${schedule.year} został oznaczony jako gotowy i jest dostępny do przeglądu.`;
          type = 'SUCCESS';
          break;
        case 'update':
          title = 'Grafik zaktualizowany';
          message = `Grafik na ${monthName} ${schedule.year} został zaktualizowany.`;
          type = 'INFO';
          break;
        default:
          title = 'Aktualizacja grafiku';
          message = `Grafik na ${monthName} ${schedule.year} został zmodyfikowany.`;
          type = 'INFO';
      }

      // Create notifications for all employees
      const notificationPromises = employees.map(employee => 
        this.prisma.notification.create({
          data: {
            userId: employee.id,
            title,
            message,
            type,
            actionUrl: `/dashboard/schedule?month=${schedule.month + 1}&year=${schedule.year}`
          }
        })
      );

      await Promise.all(notificationPromises);
      
      logger.info(`Created ${employees.length} panel notifications for schedule ${action}`);

    } catch (error) {
      logger.error('Error creating panel notifications:', error.message);
    }
  }
}

export default EnhancedScheduleService;
