/**
 * Employee Service
 * Handles all employee-related business logic
 */

import { EmbedBuilder } from 'discord.js';
import logger from '../config/logger.js';

/**
 * Service for managing employees
 */
export class EmployeeService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Notifies employee via Discord
   * @param {Object} employee - Employee model instance
   * @param {string} action - Action type (employee_added, employee_updated, employee_deleted)
   * @param {Client} client - Discord client
   */
  async notifyEmployee(employee, action, client) {
    logger.info(`Attempting to notify employee ${employee.id} for action: ${action}`, {
      employeeId: employee.id,
      employeeName: employee.name,
      discordId: employee.discordId,
      hasClient: !!client
    });

    if (!employee.discordId) {
      logger.warn(`No Discord ID for employee ${employee.id}`);
      return;
    }

    if (!client) {
      logger.error(`No Discord client provided for employee ${employee.id}`);
      return;
    }

    const embeds = {
      employee_added: new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('Witaj w systemie!')
        .setDescription(`Twoje konto pracownika (${employee.name}) zostało dodane.`)
        .setTimestamp(),
      employee_updated: new EmbedBuilder()
        .setColor('#00ffa6')
        .setTitle('Dane zaktualizowane')
        .setDescription(`Twoje dane pracownika (${employee.name}) zostały zaktualizowane.`)
        .setTimestamp(),
      employee_deleted: new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Konto usunięte')
        .setDescription(`Twoje konto pracownika (${employee.name}) zostało usunięte.`)
        .setTimestamp()
    };

    try {
      logger.info(`Fetching Discord user with ID: ${employee.discordId}`);
      const user = await client.users.fetch(employee.discordId);
      logger.info(`Successfully fetched Discord user: ${user.username}#${user.discriminator}`);
      
      logger.info(`Sending DM to Discord user: ${user.username}`);
      await user.send({ embeds: [embeds[action]] });
      logger.info(`Successfully notified employee ${employee.id} for ${action}`);
    } catch (error) {
      logger.error(`Failed to notify employee ${employee.id} for ${action}: ${error.message}`, {
        error: error.message,
        stack: error.stack,
        discordId: employee.discordId
      });
    }
  }

  /**
   * Adds a new employee
   * @param {Object} data - Employee data
   * @param {Client} client - Discord client
   * @returns {Object} Created employee
   */
  async addEmployee(data, client) {
    const { id, name, discordId } = data;
    if (!id || !/^[A-Z]{3}$/.test(id)) {
      throw new Error('Invalid ID: Must be 3 uppercase letters');
    }
    if (!name?.trim()) {
      throw new Error('Name is required');
    }
    if (discordId && !/^\d{17,19}$/.test(discordId)) {
      throw new Error('Invalid Discord ID');
    }

    return await this.prisma.$transaction(async (tx) => {
      const exists = await this.prisma.employee.findUnique({ where: { id } });
      if (exists) {
        throw new Error('Employee ID already exists');
      }

      const employee = await this.prisma.employee.create({ 
        data: { id, name, discordId } 
      });
      await this.notifyEmployee(employee, 'employee_added', client);
      return employee;
    });
  }

  /**
   * Updates an employee
   * @param {string} id - Employee ID
   * @param {Object} data - Updated data
   * @param {Client} client - Discord client
   * @returns {Object} Updated employee
   */
  async updateEmployee(id, data, client) {
    logger.info(`updateEmployee called with:`, {
      employeeId: id,
      data: data,
      hasClient: !!client,
      clientType: client ? typeof client : 'undefined'
    });

    const { name, discordId } = data;
    if (!name?.trim()) {
      throw new Error('Name is required');
    }
    if (discordId && !/^\d{17,19}$/.test(discordId)) {
      throw new Error('Invalid Discord ID');
    }

    return await this.prisma.$transaction(async (tx) => {
      logger.info(`Starting transaction for employee update: ${id}`);
      
      const employee = await this.prisma.employee.findUnique({ where: { id } });
      if (!employee) {
        throw new Error('Employee not found');
      }

      logger.info(`Found employee:`, {
        id: employee.id,
        name: employee.name,
        discordId: employee.discordId
      });

      const updatedEmployee = await this.prisma.employee.update({
        where: { id },
        data: { name, discordId: discordId || null }
      });
      
      logger.info(`Employee updated successfully:`, {
        id: updatedEmployee.id,
        name: updatedEmployee.name,
        discordId: updatedEmployee.discordId
      });

      logger.info(`Calling notifyEmployee for updated employee`);
      await this.notifyEmployee(updatedEmployee, 'employee_updated', client);
      
      logger.info(`Returning updated employee`);
      return updatedEmployee;
    });
  }

  /**
   * Deletes an employee
   * @param {string} id - Employee ID
   * @param {Client} client - Discord client
   * @returns {Object} Deletion result
   */
  async deleteEmployee(id, client) {
    return await this.prisma.$transaction(async (tx) => {
      const employee = await this.prisma.employee.findUnique({ where: { id } });
      if (!employee) {
        throw new Error('Employee not found');
      }

      const schedules = await this.prisma.schedule.findMany();
      if (schedules.some((schedule) => schedule.shifts && schedule.shifts[id])) {
        throw new Error('Employee is assigned to schedules');
      }

      await this.notifyEmployee(employee, 'employee_deleted', client);
      await this.prisma.employee.delete({
        where: { id }
      });
      
      return { message: 'Employee deleted' };
    });
  }

  /**
   * Gets all employees
   * @returns {Object[]} All employees
   */
  async getAllEmployees() {
    return await this.prisma.employee.findMany();
  }
}

export default EmployeeService;
