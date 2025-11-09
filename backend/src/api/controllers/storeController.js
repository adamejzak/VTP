/**
 * Store Controller
 * Handles HTTP requests for store operations
 */

import logger from '../../config/logger.js';

/**
 * Controller for store operations
 */
export class StoreController {
  constructor(storeService) {
    this.storeService = storeService;
  }

  /**
   * Creates a new store
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createStore(req, res) {
    try {
      const { name, workingHoursPerDay } = req.body;
      
      if (!name || !workingHoursPerDay) {
        return res.status(400).json({
          success: false,
          message: 'Name and working hours per day are required'
        });
      }

      const store = await this.storeService.createStore({
        name,
        workingHoursPerDay
      });

      logger.info(`Store created: ${store.name} (ID: ${store.id})`);

      res.status(201).json({
        success: true,
        message: 'Store created successfully',
        data: store
      });
    } catch (error) {
      logger.error('Error creating store:', error.message);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Gets all stores
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getAllStores(req, res) {
    try {
      const { activeOnly } = req.query;
      const activeOnlyBool = activeOnly === 'true';
      
      const stores = await this.storeService.getAllStores(activeOnlyBool);

      res.json({
        success: true,
        data: stores
      });
    } catch (error) {
      logger.error('Error fetching stores:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch stores'
      });
    }
  }

  /**
   * Gets a store by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getStoreById(req, res) {
    try {
      const { id } = req.params;
      const store = await this.storeService.getStoreById(id);

      res.json({
        success: true,
        data: store
      });
    } catch (error) {
      logger.error('Error fetching store:', error.message);
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Updates a store
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateStore(req, res) {
    try {
      const { id } = req.params;
      const { name, workingHoursPerDay, isActive } = req.body;

      const store = await this.storeService.updateStore(id, {
        name,
        workingHoursPerDay,
        isActive
      });

      logger.info(`Store updated: ${store.name} (ID: ${store.id})`);

      res.json({
        success: true,
        message: 'Store updated successfully',
        data: store
      });
    } catch (error) {
      logger.error('Error updating store:', error.message);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Deletes a store
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteStore(req, res) {
    try {
      const { id } = req.params;
      const result = await this.storeService.deleteStore(id);

      logger.info(`Store deleted: ID ${id}`);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      logger.error('Error deleting store:', error.message);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Gets store statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getStoreStatistics(req, res) {
    try {
      const { id } = req.params;
      const { month, year } = req.query;

      if (!month || !year) {
        return res.status(400).json({
          success: false,
          message: 'Month and year are required'
        });
      }

      const statistics = await this.storeService.getStoreStatistics(
        id, 
        parseInt(month), 
        parseInt(year)
      );

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      logger.error('Error fetching store statistics:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch store statistics'
      });
    }
  }
}

export default StoreController;
