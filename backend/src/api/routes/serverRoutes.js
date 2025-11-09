/**
 * Server Routes
 * Defines API routes for Discord server management
 */

import { Router } from 'express';
import { ServerController } from '../controllers/serverController.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireEmployee } from '../../middleware/authorization.js';

/**
 * Creates server management routes
 * @param {Client} discordClient - Discord client instance
 * @returns {Router} Express router
 */
export function createServerRoutes(discordClient) {
  const router = Router();
  const serverController = new ServerController(discordClient);

  // All server routes require authentication and employee role or higher
  router.use(authenticateJWT);
  router.use(requireEmployee);

  // Server routes (single server architecture)
  router.get('/', serverController.getServer.bind(serverController));
  router.get('/details', serverController.getServerDetails.bind(serverController));
  router.get('/members', serverController.getServerMembers.bind(serverController));
  router.get('/channels', serverController.getServerChannels.bind(serverController));
  router.get('/permissions', serverController.getBotPermissions.bind(serverController));

  return router;
}
