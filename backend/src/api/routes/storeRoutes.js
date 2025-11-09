/**
 * Store Routes
 * Defines API routes for store operations
 */

import { Router } from 'express';
import { StoreController } from '../controllers/storeController.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/authorization.js';

/**
 * Creates store routes
 * @param {StoreService} storeService - Store service instance
 * @returns {Router} Express router
 */
export function createStoreRoutes(storeService) {
  const router = Router();
  const storeController = new StoreController(storeService);

  // All store routes require authentication
  router.use(authenticateJWT);

  // Read operations - allow both employees and admins
  router.get('/', storeController.getAllStores.bind(storeController));
  router.get('/:id', storeController.getStoreById.bind(storeController));
  router.get('/:id/statistics', storeController.getStoreStatistics.bind(storeController));

  // Write operations - require admin role
  router.use(requireAdmin);
  router.post('/', storeController.createStore.bind(storeController));
  router.put('/:id', storeController.updateStore.bind(storeController));
  router.delete('/:id', storeController.deleteStore.bind(storeController));

  return router;
}
