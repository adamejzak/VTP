/**
 * Employee Controller
 * Handles HTTP requests for employee-related operations
 */

import logger from '../../config/logger.js';

/**
 * Employee Controller class
 */
export class EmployeeController {
  constructor(employeeService) {
    this.employeeService = employeeService;
  }

  /**
   * Gets all employees
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async getAllEmployees(req, res) {
    try {
      const employees = await this.employeeService.getAllEmployees();
      res.json(employees);
    } catch (error) {
      logger.error(`Fetch employees error: ${error.message}`);
      res.status(500).json({ error: 'Failed to fetch employees' });
    }
  }

  /**
   * Creates a new employee
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async createEmployee(req, res) {
    try {
      const employee = await this.employeeService.addEmployee(req.body, req.app.get('discordClient'));
      res.json(employee);
    } catch (error) {
      logger.error(`Add employee error: ${error.message}`);
      res.status(error.message.includes('already exists') ? 400 : 500).json({ error: error.message });
    }
  }

  /**
   * Updates an employee
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async updateEmployee(req, res) {
    try {
      const employee = await this.employeeService.updateEmployee(req.params.id, req.body, req.app.get('discordClient'));
      res.json(employee);
    } catch (error) {
      logger.error(`Update employee error: ${error.message}`);
      res.status(error.message.includes('not found') ? 404 : 400).json({ error: error.message });
    }
  }

  /**
   * Deletes an employee
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async deleteEmployee(req, res) {
    try {
      const result = await this.employeeService.deleteEmployee(req.params.id, req.app.get('discordClient'));
      res.json(result);
    } catch (error) {
      logger.error(`Delete employee error: ${error.message}`);
      res.status(error.message.includes('not found') ? 404 : 400).json({ error: error.message });
    }
  }
}

export default EmployeeController;
