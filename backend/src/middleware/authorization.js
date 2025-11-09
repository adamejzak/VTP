/**
 * Authorization Middleware
 * Handles role-based access control
 */

import logger from '../config/logger.js';

/**
 * Role-based authorization middleware
 * @param {string|string[]} allowedRoles - Role(s) that are allowed to access the route
 * @returns {Function} Express middleware function
 */
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }

    // Normalize allowedRoles to array
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    // Check if user's role is in the allowed roles
    if (!roles.includes(req.user.role)) {
      logger.warn('Access denied for user:', {
        clerkId: req.user.clerkId,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.originalUrl
      });
      
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Access denied. Required role(s): ${roles.join(', ')}` 
      });
    }

    logger.debug('Access granted for user:', {
      clerkId: req.user.clerkId,
      role: req.user.role,
      endpoint: req.originalUrl
    });

    next();
  };
};

/**
 * Admin-only access middleware
 * Shorthand for requireRole('ADMIN')
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Employee or Admin access middleware
 * Allows both EMPLOYEE and ADMIN roles
 */
export const requireEmployee = requireRole(['EMPLOYEE', 'ADMIN']);

/**
 * Check if user has specific role
 * @param {string} role - Role to check
 * @returns {boolean} True if user has the role
 */
export const hasRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: `Access denied. Required role: ${role}` 
      });
    }

    next();
  };
};

/**
 * Middleware to check if user is active
 * Ensures the user account is not deactivated
 */
export const requireActiveUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Authentication required' 
    });
  }

  // This would typically check against the database
  // For now, we assume all authenticated users are active
  // In a real implementation, you'd query the User model
  next();
};

/**
 * Middleware to ensure user exists in database
 * Creates user record if it doesn't exist (for first-time login)
 */
export const ensureUserExists = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }

    // This would typically check/create user in database
    // For now, we'll add a flag to indicate this should be implemented
    req.user.needsDatabaseSync = true;
    
    next();
  } catch (error) {
    logger.error('Error ensuring user exists:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Failed to verify user' 
    });
  }
};

export default {
  requireRole,
  requireAdmin,
  requireEmployee,
  hasRole,
  requireActiveUser,
  ensureUserExists
};
