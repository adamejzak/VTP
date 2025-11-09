/**
 * Employee Routes
 * Defines API routes for employee operations
 */

import { Router } from 'express';
import { EmployeeController } from '../controllers/employeeController.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireEmployee, requireAdmin } from '../../middleware/authorization.js';

/**
 * Creates employee routes
 * @param {EmployeeService} employeeService - Employee service instance
 * @returns {Router} Express router
 */
export function createEmployeeRoutes(employeeService) {
  const router = Router();
  const employeeController = new EmployeeController(employeeService);

  // All employee routes require authentication and employee role or higher
  router.use(authenticateJWT);
  router.use(requireEmployee);

  // Employee routes
  router.get('/', employeeController.getAllEmployees.bind(employeeController));
  router.post('/', requireAdmin, employeeController.createEmployee.bind(employeeController));
  router.put('/:id', requireAdmin, employeeController.updateEmployee.bind(employeeController));
  router.delete('/:id', requireAdmin, employeeController.deleteEmployee.bind(employeeController));

  return router;
}
