/**
 * Database configuration and connection setup
 * Handles Sequelize initialization and model management
 */

import { Sequelize } from 'sequelize';
import { config } from './index.js';
import logger from './logger.js';

/**
 * Database class for managing Sequelize connection and models
 */
class Database {
  constructor() {
    this.sequelize = null;
    this.models = {};
    this.Op = Sequelize.Op;
  }

  /**
   * Initialize database connection and models
   */
  async initialize() {
    try {
      // Initialize Sequelize connection
      this.sequelize = new Sequelize(config.database.url, {
        logging: (msg) => logger.debug(msg),
        dialect: 'sqlite',
        storage: './database.sqlite',
        define: {
          timestamps: true,
          underscored: true
        }
      });

      // Test connection
      await this.sequelize.authenticate();
      logger.info('Database connection established successfully');

      // Initialize models
      await this.initializeModels();
      
      // Sync database
      await this.sequelize.sync({ alter: true });
      logger.info('Database synchronized successfully');

    } catch (error) {
      logger.error('Unable to connect to the database:', error);
      throw error;
    }
  }

  /**
   * Initialize all database models
   */
  async initializeModels() {
    // User model (for Clerk authentication and role management)
    this.models.User = this.sequelize.define('User', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false
      },
      clerkId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      role: {
        type: Sequelize.ENUM('admin', 'employee'),
        allowNull: false,
        defaultValue: 'employee'
      },
      discordId: {
        type: Sequelize.STRING,
        allowNull: true
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    });

    // Employee model (legacy - for backward compatibility)
    this.models.Employee = this.sequelize.define('Employee', {
      id: {
        type: Sequelize.STRING(3),
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      discordId: {
        type: Sequelize.STRING,
        allowNull: true
      }
    });

    // Task model
    this.models.Task = this.sequelize.define('Task', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'low'
      },
      assignedTo: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      completed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    });

    // TaskCompletion model
    this.models.TaskCompletion = this.sequelize.define('TaskCompletion', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      taskId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Tasks',
          key: 'id'
        }
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // ArchivedTask model
    this.models.ArchivedTask = this.sequelize.define('ArchivedTask', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high'),
        allowNull: false
      },
      assignedTo: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      completionDetails: {
        type: Sequelize.JSON,
        allowNull: true
      }
    });

    // DickMeasurement model (for the fun command)
    this.models.DickMeasurement = this.sequelize.define('DickMeasurement', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: false
      },
      size: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      measuredAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Schedule model
    this.models.Schedule = this.sequelize.define('Schedule', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      month: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      shifts: {
        type: Sequelize.JSON,
        allowNull: false
      },
      createdBy: {
        type: Sequelize.STRING(3),
        allowNull: false,
        references: {
          model: 'Employees',
          key: 'id'
        }
      }
    });

    // Define associations
    this.models.Task.hasMany(this.models.TaskCompletion, { 
      foreignKey: 'taskId', 
      as: 'TaskCompletions' 
    });
    this.models.TaskCompletion.belongsTo(this.models.Task, { 
      foreignKey: 'taskId' 
    });

    // Schedule associations
    this.models.Schedule.belongsTo(this.models.Employee, { 
      foreignKey: 'createdBy', 
      as: 'Creator' 
    });

    logger.info('Database models initialized successfully');
  }

  /**
   * Get all models
   */
  getModels() {
    return this.models;
  }

  /**
   * Get Sequelize instance
   */
  getSequelize() {
    return this.sequelize;
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.sequelize) {
      await this.sequelize.close();
      logger.info('Database connection closed');
    }
  }
}

export default Database;
