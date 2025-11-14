/**
 * Discord Bot Command Handler
 * Dynamically loads and manages Discord commands
 */

import { REST, Routes } from 'discord.js';
import logger from '../config/logger.js';
import { DatabaseAdapter } from '../lib/DatabaseAdapter.js';

/**
 * Command Handler class
 */
export class CommandHandler {
  constructor(prisma) {
    this.prisma = prisma;
    this.database = new DatabaseAdapter();
    this.commands = new Map();
    this.loadCommands();
  }

  /**
   * Dynamically loads all command files
   */
  async loadCommands() {
    try {
      // Import all command modules
      const commandModules = await Promise.all([
        import('./commands/dickCommand.js'),
        import('./commands/rankingCommand.js'),
        import('./commands/scheduleCommand.js'),
        import('./commands/rockPaperScissorsCommand.js'),
        import('./commands/rockPaperScissorsUserContextCommand.js'),
        import('./commands/ticTacToeCommand.js'),
        import('./commands/ticTacToeUserContextCommand.js'),
        import('./commands/wersjaCommand.js'),
        import('./commands/kodCommand.js'),
        import('./commands/pingCommand.js'),
        import('./commands/speedtestCommand.js')
      ]);

      // Register each command
      for (const module of commandModules) {
        if (module.data && module.execute) {
          this.commands.set(module.data.name, {
            data: module.data,
            execute: module.execute
          });
          logger.info(`Loaded command: ${module.data.name}`);
        }
      }

      logger.info(`Successfully loaded ${this.commands.size} commands`);
    } catch (error) {
      logger.error(`Failed to load commands: ${error.message}`, { stack: error.stack });
    }
  }

  /**
   * Registers slash commands with Discord
   * @param {Client} client - Discord client
   */
  async registerCommands(client) {
    try {
      const rest = new REST({ version: '10' }).setToken(client.token);
      const commandData = Array.from(this.commands.values()).map(cmd => cmd.data.toJSON());

      logger.info('Registering slash commands...');
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commandData
      });
      logger.info('Successfully registered slash commands');
    } catch (error) {
      logger.error(`Failed to register slash commands: ${error.message}`, { stack: error.stack });
    }
  }

  /**
   * Handles slash command interactions
   * @param {Interaction} interaction - Discord interaction
   */
  async handle(interaction) {
    if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) {
      return;
    }

    const { commandName } = interaction;
    const command = this.commands.get(commandName);

    if (!command) {
      logger.warn(`Unknown command: ${commandName}`);
      return interaction.reply({
        content: 'Nieznana komenda.',
        ephemeral: true
      });
    }

    try {
      await command.execute(interaction, {
        prisma: this.prisma
      });
    } catch (error) {
      logger.error(`Command ${commandName} error: ${error.message}`, { stack: error.stack });
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Wystąpił błąd podczas przetwarzania polecenia.',
          ephemeral: true
        });
      }
    }
  }

}

export default CommandHandler;
