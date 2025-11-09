/**
 * Bot Routes
 * Defines API routes for Discord bot management
 */

import { Router } from 'express';
import { BotController } from '../controllers/botController.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireEmployee } from '../../middleware/authorization.js';

/**
 * Creates bot management routes
 * @param {Client} discordClient - Discord client instance
 * @param {PrismaClient} prisma - Prisma client instance
 * @returns {Router} Express router
 */
export function createBotRoutes(discordClient, prisma) {
  const router = Router();
  const botController = new BotController(discordClient, prisma);

  // All bot routes require authentication and employee role (or admin)
  router.use(authenticateJWT);
  router.use(requireEmployee);

  // Bot management routes
  router.get('/info', botController.getBotInfo.bind(botController));
  router.put('/status', botController.updateBotStatus.bind(botController));
  router.delete('/status', botController.clearBotStatus.bind(botController));
  router.get('/logs', botController.getBotLogs.bind(botController));
  router.get('/ranking', botController.getDickRanking.bind(botController));
  router.post('/send-message', botController.sendMessage.bind(botController));
  router.post('/send-dm', botController.sendDirectMessage.bind(botController));

  return router;
}
