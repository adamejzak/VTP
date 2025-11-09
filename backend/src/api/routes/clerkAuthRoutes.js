/**
 * Clerk Authentication Routes
 * Defines API routes for Clerk JWT authentication operations
 */

import { Router } from 'express';
import { ClerkAuthController } from '../controllers/clerkAuthController.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireAdmin, requireRole, requireEmployee } from '../../middleware/authorization.js';

/**
 * Creates Clerk authentication routes
 * @param {ClerkAuthService} clerkAuthService - Clerk auth service instance
 * @returns {Router} Express router
 */
export function createClerkAuthRoutes(clerkAuthService) {
  const router = Router();
  const clerkAuthController = new ClerkAuthController(clerkAuthService);

  // Public routes (no authentication required)
  // Note: These would typically be handled by Clerk's frontend SDK
  
  // Protected routes (authentication required)
  router.get('/me', authenticateJWT, clerkAuthController.getCurrentUser.bind(clerkAuthController));
  
  // Sync route - no authentication required (first-time user setup)
  router.post('/sync', clerkAuthController.syncUser.bind(clerkAuthController));

  // Employee routes (for schedule display)
  router.get('/employees', 
    authenticateJWT, 
    requireEmployee, 
    clerkAuthController.getEmployeesForSchedule.bind(clerkAuthController)
  );

  // Admin-only routes
  router.get('/users', 
    authenticateJWT, 
    requireAdmin, 
    clerkAuthController.getAllUsers.bind(clerkAuthController)
  );
  
  router.put('/users/:clerkId/role', 
    authenticateJWT, 
    requireAdmin, 
    clerkAuthController.updateUserRole.bind(clerkAuthController)
  );
  
  router.put('/users/:clerkId/deactivate', 
    authenticateJWT, 
    requireAdmin, 
    clerkAuthController.deactivateUser.bind(clerkAuthController)
  );
  
  router.put('/users/:clerkId/activate', 
    authenticateJWT, 
    requireAdmin, 
    clerkAuthController.activateUser.bind(clerkAuthController)
  );

  router.put('/users/:clerkId/discord', 
    authenticateJWT, 
    requireAdmin, 
    clerkAuthController.updateUserDiscord.bind(clerkAuthController)
  );

  router.put('/users/:clerkId', 
    authenticateJWT, 
    requireAdmin, 
    clerkAuthController.updateUser.bind(clerkAuthController)
  );

  router.delete('/users/:clerkId', 
    authenticateJWT, 
    requireAdmin, 
    clerkAuthController.deleteUser.bind(clerkAuthController)
  );

  router.post('/users/create', 
    authenticateJWT, 
    requireAdmin, 
    clerkAuthController.createUser.bind(clerkAuthController)
  );

  return router;
}
