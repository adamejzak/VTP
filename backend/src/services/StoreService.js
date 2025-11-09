/**
 * Store Service
 * Handles all store-related business logic
 */

import logger from '../config/logger.js';

/**
 * Service for managing stores (workplaces)
 */
export class StoreService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Validates store data
   * @param {Object} data - Store data
   * @returns {boolean} Validation result
   */
  async validateStoreData({ name, workingHoursPerDay }) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Store name is required');
    }

    if (!workingHoursPerDay || typeof workingHoursPerDay !== 'object') {
      throw new Error('Working hours per day is required');
    }

    // Validate working hours structure
    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of validDays) {
      if (workingHoursPerDay[day] === undefined) {
        throw new Error(`Working hours for ${day} is required`);
      }
      if (typeof workingHoursPerDay[day] !== 'number' || workingHoursPerDay[day] < 0 || workingHoursPerDay[day] > 24) {
        throw new Error(`Invalid working hours for ${day}. Must be between 0 and 24`);
      }
    }

    return true;
  }

  /**
   * Creates a new store
   * @param {Object} data - Store data
   * @returns {Object} Created store
   */
  async createStore(data) {
    const { name, workingHoursPerDay } = data;
    await this.validateStoreData({ name, workingHoursPerDay });

    // Check if store with same name already exists
    const existingStore = await this.prisma.store.findFirst({
      where: { name: name.trim() }
    });

    if (existingStore) {
      throw new Error('Store with this name already exists');
    }

    return await this.prisma.store.create({
      data: {
        name: name.trim(),
        workingHoursPerDay: JSON.stringify(workingHoursPerDay),
        isActive: true
      }
    });
  }

  /**
   * Gets all stores
   * @param {boolean} activeOnly - Whether to return only active stores
   * @returns {Object[]} All stores
   */
  async getAllStores(activeOnly = false) {
    const where = activeOnly ? { isActive: true } : {};
    
    const stores = await this.prisma.store.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    // Parse working hours for each store
    return stores.map(store => ({
      ...store,
      workingHoursPerDay: JSON.parse(store.workingHoursPerDay)
    }));
  }

  /**
   * Gets a store by ID
   * @param {string} id - Store ID
   * @returns {Object} Store
   */
  async getStoreById(id) {
    const store = await this.prisma.store.findUnique({
      where: { id }
    });

    if (!store) {
      throw new Error('Store not found');
    }

    return {
      ...store,
      workingHoursPerDay: JSON.parse(store.workingHoursPerDay)
    };
  }

  /**
   * Updates a store
   * @param {string} id - Store ID
   * @param {Object} data - Updated store data
   * @returns {Object} Updated store
   */
  async updateStore(id, data) {
    const { name, workingHoursPerDay, isActive } = data;
    
    if (name || workingHoursPerDay) {
      await this.validateStoreData({ 
        name: name || 'temp', 
        workingHoursPerDay: workingHoursPerDay || {} 
      });
    }

    const existingStore = await this.prisma.store.findUnique({ where: { id } });
    if (!existingStore) {
      throw new Error('Store not found');
    }

    // Check if name is being changed and if it conflicts
    if (name && name.trim() !== existingStore.name) {
      const nameConflict = await this.prisma.store.findFirst({
        where: { 
          name: name.trim(),
          id: { not: id }
        }
      });

      if (nameConflict) {
        throw new Error('Store with this name already exists');
      }
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (workingHoursPerDay) updateData.workingHoursPerDay = JSON.stringify(workingHoursPerDay);
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedStore = await this.prisma.store.update({
      where: { id },
      data: updateData
    });

    return {
      ...updatedStore,
      workingHoursPerDay: JSON.parse(updatedStore.workingHoursPerDay)
    };
  }

  /**
   * Deletes a store
   * @param {string} id - Store ID
   * @returns {Object} Deletion result
   */
  async deleteStore(id) {
    const store = await this.prisma.store.findUnique({ where: { id } });
    if (!store) {
      throw new Error('Store not found');
    }

    // Check if store has any assignments
    const assignments = await this.prisma.assignment.findFirst({
      where: { storeId: id }
    });

    if (assignments) {
      throw new Error('Cannot delete store with existing assignments. Deactivate it instead.');
    }

    await this.prisma.store.delete({ where: { id } });
    return { message: 'Store deleted successfully' };
  }

  /**
   * Gets working hours for a specific day
   * @param {string} storeId - Store ID
   * @param {number} dayOfWeek - Day of week (0 = Sunday, 1 = Monday, etc.)
   * @returns {number} Working hours for the day
   */
  async getWorkingHoursForDay(storeId, dayOfWeek) {
    const store = await this.getStoreById(storeId);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    
    return store.workingHoursPerDay[dayName] || 0;
  }

  /**
   * Gets total working hours for a month
   * @param {string} storeId - Store ID
   * @param {number} month - Month (0-11)
   * @param {number} year - Year
   * @returns {number} Total working hours for the month
   */
  async getTotalWorkingHoursForMonth(storeId, month, year) {
    const store = await this.getStoreById(storeId);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let totalHours = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];
      
      totalHours += store.workingHoursPerDay[dayName] || 0;
    }

    return totalHours;
  }

  /**
   * Gets store statistics
   * @param {string} storeId - Store ID
   * @param {number} month - Month (0-11)
   * @param {number} year - Year
   * @returns {Object} Store statistics
   */
  async getStoreStatistics(storeId, month, year) {
    const store = await this.getStoreById(storeId);
    
    // Get assignments for this store in the given month
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    
    const assignments = await this.prisma.assignment.findMany({
      where: {
        storeId,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        Schedule: true
      }
    });

    const totalAssignedHours = assignments.reduce((sum, assignment) => sum + assignment.hours, 0);
    const totalWorkingHours = await this.getTotalWorkingHoursForMonth(storeId, month, year);
    const uniqueEmployees = new Set(assignments.map(a => a.employeeId)).size;

    return {
      store,
      totalAssignedHours,
      totalWorkingHours,
      coveragePercentage: totalWorkingHours > 0 ? (totalAssignedHours / totalWorkingHours) * 100 : 0,
      uniqueEmployees,
      assignmentCount: assignments.length
    };
  }
}

export default StoreService;
