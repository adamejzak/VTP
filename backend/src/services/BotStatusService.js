/**
 * Bot Status Service
 * Manages bot status persistence and restoration
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATUS_FILE = path.join(__dirname, '../../data/bot-status.json');

/**
 * Service for managing bot status persistence
 */
export class BotStatusService {
  constructor() {
    this.ensureDataDirectory();
  }

  /**
   * Ensures data directory exists
   */
  async ensureDataDirectory() {
    try {
      const dataDir = path.dirname(STATUS_FILE);
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create data directory:', error);
    }
  }

  /**
   * Save bot status to file
   * @param {Object} status - Bot status object
   */
  async saveStatus(status) {
    try {
      await this.ensureDataDirectory();
      await fs.writeFile(STATUS_FILE, JSON.stringify(status, null, 2));
      logger.info('Bot status saved to file');
    } catch (error) {
      logger.error('Failed to save bot status:', error);
    }
  }

  /**
   * Load bot status from file
   * @returns {Object|null} Bot status object or null if not found
   */
  async loadStatus() {
    try {
      const data = await fs.readFile(STATUS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('No saved bot status found');
        return null;
      }
      logger.error('Failed to load bot status:', error);
      return null;
    }
  }

  /**
   * Clear saved bot status
   */
  async clearStatus() {
    try {
      await fs.unlink(STATUS_FILE);
      logger.info('Bot status file cleared');
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('No bot status file to clear');
        return;
      }
      logger.error('Failed to clear bot status file:', error);
    }
  }
}

export default BotStatusService;

