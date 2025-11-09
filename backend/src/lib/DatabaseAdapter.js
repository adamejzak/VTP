/**
 * Database Adapter
 * Provides compatibility layer between old Sequelize-style commands and Prisma
 */

import { prisma } from './prisma.js';

/**
 * Database adapter that provides Sequelize-style interface for Prisma
 */
export class DatabaseAdapter {
  constructor() {
    const self = this;
    this.models = {
      DickMeasurement: {
        create: async (data) => {
          return await prisma.dickMeasurement.create({ data });
        },
        findAll: async (options = {}) => {
          if (options.where) {
            // Convert Sequelize-style where to Prisma-style
            const whereClause = self.convertWhereClause(options.where);
            return await prisma.dickMeasurement.findMany({ where: whereClause });
          }
          return await prisma.dickMeasurement.findMany();
        },
        findOne: async (options = {}) => {
          if (options.where) {
            return await prisma.dickMeasurement.findFirst({ where: options.where });
          }
          return await prisma.dickMeasurement.findFirst();
        }
      },
      Employee: {
        findAll: async (options = {}) => {
          if (options.where) {
            return await prisma.user.findMany({ where: options.where });
          }
          return await prisma.user.findMany();
        },
        findOne: async (options = {}) => {
          if (options.where) {
            return await prisma.user.findFirst({ where: options.where });
          }
          return await prisma.user.findFirst();
        }
      },
      Task: {
        create: async (data) => {
          return await prisma.task.create({ data });
        },
        findAll: async (options = {}) => {
          if (options.where) {
            return await prisma.task.findMany({ where: options.where });
          }
          return await prisma.task.findMany();
        },
        findOne: async (options = {}) => {
          if (options.where) {
            return await prisma.task.findFirst({ where: options.where });
          }
          return await prisma.task.findFirst();
        },
        update: async (data, options = {}) => {
          if (options.where) {
            return await prisma.task.updateMany({ where: options.where, data });
          }
          return await prisma.task.update({ where: { id: data.id }, data });
        }
      },
      TaskCompletion: {
        create: async (data) => {
          return await prisma.taskCompletion.create({ data });
        },
        findAll: async (options = {}) => {
          if (options.where) {
            return await prisma.taskCompletion.findMany({ where: options.where });
          }
          return await prisma.taskCompletion.findMany();
        }
      },
      ArchivedTask: {
        create: async (data) => {
          return await prisma.archivedTask.create({ data });
        },
        findAll: async (options = {}) => {
          if (options.where) {
            return await prisma.archivedTask.findMany({ where: options.where });
          }
          return await prisma.archivedTask.findMany();
        }
      },
      Schedule: {
        create: async (data) => {
          return await prisma.schedule.create({ data });
        },
        findAll: async (options = {}) => {
          if (options.where) {
            return await prisma.schedule.findMany({ where: options.where });
          }
          return await prisma.schedule.findMany();
        },
        findOne: async (options = {}) => {
          if (options.where) {
            return await prisma.schedule.findFirst({ where: options.where });
          }
          return await prisma.schedule.findFirst();
        }
      }
    };
  }

  /**
   * Get models (Sequelize-style interface)
   */
  getModels() {
    return this.models;
  }

  /**
   * Get Prisma operators for where clauses
   */
  get Op() {
    return {
      gte: 'gte',
      lte: 'lte',
      gt: 'gt',
      lt: 'lt',
      eq: 'equals',
      ne: 'not',
      in: 'in',
      notIn: 'notIn',
      like: 'contains',
      notLike: 'not',
      and: 'AND',
      or: 'OR'
    };
  }

  /**
   * Convert Sequelize-style where clause to Prisma-style
   */
  convertWhereClause(where) {
    const converted = {};
    
    for (const [key, value] of Object.entries(where)) {
      if (typeof value === 'object' && value !== null) {
        // Handle operators like { [Op.gte]: date }
        for (const [op, val] of Object.entries(value)) {
          switch (op) {
            case 'gte':
              converted[key] = { gte: val };
              break;
            case 'lte':
              converted[key] = { lte: val };
              break;
            case 'gt':
              converted[key] = { gt: val };
              break;
            case 'lt':
              converted[key] = { lt: val };
              break;
            case 'eq':
              converted[key] = val;
              break;
            case 'ne':
              converted[key] = { not: val };
              break;
            case 'in':
              converted[key] = { in: val };
              break;
            case 'notIn':
              converted[key] = { notIn: val };
              break;
            case 'like':
              converted[key] = { contains: val };
              break;
            case 'notLike':
              converted[key] = { not: { contains: val } };
              break;
            default:
              converted[key] = val;
          }
        }
      } else {
        converted[key] = value;
      }
    }
    
    return converted;
  }
}

export default DatabaseAdapter;
