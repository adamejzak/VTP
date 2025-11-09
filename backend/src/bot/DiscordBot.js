/**
 * Discord Bot
 * Main Discord bot class that manages the bot lifecycle
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { config } from '../config/index.js';
import logger from '../config/logger.js';
import { CommandHandler } from './CommandHandler.js';

/**
 * Main Discord bot class
 */
export class DiscordBot {
  constructor(prisma, app) {
    this.prisma = prisma;
    this.app = app;
    
    // Initialize Discord client
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    // Initialize command handler
    this.commandHandler = new CommandHandler(this.prisma);
    
    // Initialize services object for event handlers
    this.services = {
      commandHandler: this.commandHandler,
      prisma: this.prisma,
      scheduleService: null // Will be set later if needed
    };
  }

  /**
   * Starts the Discord bot
   */
  async start() {
    try {
      this.setupEventListeners();
      
      // Login to Discord first (ensures client.user is populated)
      await this.client.login(config.discord.botToken);

      // Register slash commands after successful login
      // NOTE: Commands are now deployed manually via deploy-slash-commands.js script
      // await this.commandHandler.registerCommands(this.client);
      
      // Set Discord client in Express app for API routes
      this.app.set('discordClient', this.client);
      
      logger.info('Discord bot started successfully');
    } catch (error) {
      logger.error('Failed to start Discord bot:', error);
      throw error;
    }
  }

  /**
   * Sets up client event listeners
   */
  setupEventListeners() {
    // Ready event
    this.client.on('ready', async () => {
      const { execute } = await import('./events/ready.js');
      await execute(this.client, this.services);
    });


    // Interaction create event
    this.client.on('interactionCreate', async (interaction) => {
      const { execute } = await import('./events/interactionCreate.js');
      await execute(interaction, this.services);
    });

    // Error handling
    this.client.on('error', (error) => {
      logger.error('Discord client error:', error);
    });

    // Warn handling
    this.client.on('warn', (warning) => {
      logger.warn('Discord client warning:', warning);
    });

    // Debug handling (only in development)
    if (config.nodeEnv === 'development') {
      this.client.on('debug', (info) => {
        logger.debug('Discord client debug:', info);
      });
    }
  }

  /**
   * Sets additional services (called after initialization)
   * @param {Object} services - Additional services
   */
  setServices(services) {
    this.services = { ...this.services, ...services };
  }

  /**
   * Gets the Discord client
   * @returns {Client} Discord client
   */
  getClient() {
    return this.client;
  }

  /**
   * Stops the Discord bot
   */
  async stop() {
    try {
      await this.client.destroy();
      logger.info('Discord bot stopped');
    } catch (error) {
      logger.error('Error stopping Discord bot:', error);
    }
  }
}

export default DiscordBot;
