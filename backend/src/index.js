/**
 * Main Application Entry Point
 * VTP Backend - REST API and Discord Bot
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { config } from './config/index.js';
import logger from './config/logger.js';
import { prisma } from './lib/prisma.js';

// Import services
import { EmployeeService } from './services/EmployeeService.js';
import { StoreService } from './services/StoreService.js';
import { EnhancedScheduleService } from './services/EnhancedScheduleService.js';

import ClerkAuthService from './services/ClerkAuthService.js';

// Import Discord bot
import { DiscordBot } from './bot/DiscordBot.js';

// Import API routes
import { createEmployeeRoutes } from './api/routes/employeeRoutes.js';
import { createEnhancedScheduleRoutes } from './api/routes/enhancedScheduleRoutes.js';
import { createStoreRoutes } from './api/routes/storeRoutes.js';
import { createClerkAuthRoutes } from './api/routes/clerkAuthRoutes.js';
import { createServerRoutes } from './api/routes/serverRoutes.js';
import { createBotRoutes } from './api/routes/botRoutes.js';
import { createNotificationRoutes } from './api/routes/notificationRoutes.js';

/**
 * Main application class
 */
class Application {
  constructor() {
    this.app = express();
    this.discordBot = null;
    this.services = {};
  }

  /**
   * Initializes the application
   */
  async initialize() {
    try {
      // Debug DB file access before Prisma connects (SQLite)
      try {
        const dbUrl = process.env.DATABASE_URL || config.database.url;
        if (dbUrl && dbUrl.startsWith('file:')) {
          let dbPath = dbUrl.replace(/^file:/, '');
          const resolvedPath = path.isAbsolute(dbPath)
            ? dbPath
            : path.resolve(process.cwd(), dbPath);
          // Log via both logger and console to ensure visibility
          logger.info('Resolved SQLite database path', { resolvedPath, dbUrl });
          // eslint-disable-next-line no-console
          console.log('[BOOT] DATABASE_URL:', dbUrl, '=>', resolvedPath);
          try {
            fs.accessSync(resolvedPath, fs.constants.R_OK | fs.constants.W_OK);
            const stat = fs.statSync(resolvedPath);
            logger.info('SQLite file access OK', { mode: stat.mode, size: stat.size });
            // eslint-disable-next-line no-console
            console.log('[BOOT] SQLite access OK: size', stat.size, 'mode', stat.mode);
          } catch (accessErr) {
            logger.error('SQLite file access check failed', { error: accessErr.message });
            // eslint-disable-next-line no-console
            console.error('[BOOT] SQLite access FAILED:', accessErr.message);
          }
        }
      } catch (_) {
        // ignore debug errors
      }

      console.log('[BOOT] Łączenie z bazą danych...');
      try {
        await prisma.$connect();
        logger.info('Database connection established successfully');
        // eslint-disable-next-line no-console
        console.log('[BOOT] Database connection OK');
      } catch (dbErr) {
        logger.error('Failed to connect to database', { error: dbErr.message });
        // eslint-disable-next-line no-console
        console.error('[BOOT] Database connection FAILED:', dbErr.message);
        // Continue startup; routes using DB may fail but /health will work
      }

      // Initialize services
      this.initializeServices();

      // Setup Express app
      this.setupExpress();

      // Initialize Discord bot (do not start yet)
      this.discordBot = new DiscordBot(prisma, this.app);

      // Setup API routes
      this.setupRoutes();

      logger.info('Application initialized successfully');
      // eslint-disable-next-line no-console
      console.log('[BOOT] Application initialized');
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  /**
   * Initializes all services
   */
  initializeServices() {
    // Initialize auth services
    this.services.clerkAuthService = new ClerkAuthService(prisma);

    // Initialize business services
    this.services.employeeService = new EmployeeService(prisma);
    this.services.enhancedScheduleService = new EnhancedScheduleService(prisma);
    this.services.storeService = new StoreService(prisma);

    logger.info('Services initialized successfully');
  }

  /**
   * Sets up Express application
   */
  setupExpress() {
    // Trust proxy for production
    this.app.set('trust proxy', 1);

    // CORS configuration
    this.app.use(cors(config.cors));
    // Handle preflight requests globally
    this.app.options('*', cors(config.cors));

    // Body parsing middleware
    this.app.use(express.json());

    // Debug middleware (development only)
    if (config.nodeEnv === 'development') {
      this.app.use((req, res, next) => {
        logger.debug('Request:', {
          method: req.method,
          url: req.originalUrl,
          user: req.user ? req.user.id : null
        });
        next();
      });
    }


    // Health check endpoint
    this.app.get(['/health', '/api/health'], (req, res) => {
      const backendVersion = process.env.BACKEND_VERSION || process.env.APP_VERSION || '0.0.0';
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: backendVersion
      });
    });

    logger.info('Express application configured');
  }

  /**
   * Sets up API routes
   */
  setupRoutes() {
    // Discord client middleware - adds Discord client to request
    this.app.use((req, res, next) => {
      if (this.discordBot && this.discordBot.getClient()) {
        req.discordClient = this.discordBot.getClient();
      }
      next();
    });

    // API routes
    this.app.use('/api/employees', createEmployeeRoutes(this.services.employeeService));
    this.app.use('/api/schedules', createEnhancedScheduleRoutes(this.services.enhancedScheduleService, this.services.scheduleService));
    this.app.use('/api/stores', createStoreRoutes(this.services.storeService));
    
    // Clerk authentication routes
    this.app.use('/api/auth', createClerkAuthRoutes(this.services.clerkAuthService));
    
    // Server management routes (after Discord bot is initialized)
    this.app.use('/api/server', createServerRoutes(this.discordBot.getClient()));
    
    // Bot management routes (after Discord bot is initialized)
    this.app.use('/api/bot', createBotRoutes(this.discordBot.getClient(), prisma));
    
    // Notification routes
    this.app.use('/api/notifications', createNotificationRoutes(prisma));

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Nie znaleziono trasy' });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error:', error);
      res.status(500).json({ error: 'Internal server error' });
    });

    logger.info('API routes configured');
  }

  /**
   * Starts the server
   */
  async start() {
    try {
      await this.initialize();

      const server = this.app.listen(config.port, () => {
        logger.info(`Server running on port ${config.port}`);
        logger.info(`Environment: ${config.nodeEnv}`);
        // eslint-disable-next-line no-console
        console.log(`[BOOT] Server listening on ${config.port} in ${config.nodeEnv}`);
      });

      // Start Discord bot asynchronously after server is up
      this.discordBot
        .start()
        .then(() => {
          this.discordBot.setServices({
            scheduleService: this.services.enhancedScheduleService
          });
        })
        .catch((err) => {
          logger.error('Discord bot failed to start:', err);
        });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown(server));
      process.on('SIGINT', () => this.shutdown(server));

    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   * @param {Server} server - HTTP server instance
   */
  async shutdown(server) {
    logger.info('Shutting down application...');

    try {
      // Close HTTP server
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Stop Discord bot
      if (this.discordBot) {
        await this.discordBot.stop();
      }

      // Close database connection
      if (this.database) {
        await this.database.close();
      }

      logger.info('Application shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the application
const app = new Application();
app.start().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
