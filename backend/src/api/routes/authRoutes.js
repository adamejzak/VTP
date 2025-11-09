/**
 * Authentication Routes
 * Defines API routes for authentication operations
 */

import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';

/**
 * Creates authentication routes
 * @param {AuthService} authService - Auth service instance
 * @returns {Router} Express router
 */
export function createAuthRoutes(authService) {
  const router = Router();
  const authController = new AuthController(authService);

  // Auth routes
  router.get('/discord', authController.discordAuth.bind(authController));
  router.get('/discord/callback', authController.discordCallback.bind(authController));
  router.get('/user', authController.getUser.bind(authController));
  router.get('/logout', authController.logout.bind(authController));

  return router;
}
