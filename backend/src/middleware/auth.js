/**
 * Authentication Middleware
 * Handles JWT authentication using Clerk
 */

import { verifyToken } from '@clerk/clerk-sdk-node';
import { config } from '../config/index.js';
import logger from '../config/logger.js';
import { prisma } from '../lib/prisma.js';

/**
 * JWT Authentication Middleware
 * Verifies Clerk JWT tokens and attaches user info to request
 */
export const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'No valid authorization header provided' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'No token provided' 
      });
    }

    // Verify the JWT token with Clerk
    const payload = await verifyToken(token, {
      secretKey: config.clerk.secretKey
    });

    if (!payload) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid token' 
      });
    }

    // Get user role from database and auto-sync if needed
    let userRole = 'NONE';
    let dbUser = null;
    try {
      dbUser = await prisma.user.findUnique({
        where: { clerkId: payload.sub }
      });
      
      if (dbUser) {
        userRole = dbUser.role;
      } else {
        // User doesn't exist in database, create them automatically
        logger.info('User not found in database, creating new user:', payload.sub);
        
        dbUser = await prisma.user.create({
          data: {
            clerkId: payload.sub,
            firstName: payload.given_name || '',
            lastName: payload.family_name || '',
            role: 'NONE', // Default role - admin can change this later
            isActive: false, // Default inactive - admin needs to activate
            discordId: null
          }
        });
        
        logger.info('New user created in database:', {
          clerkId: payload.sub
        });
      }
    } catch (error) {
      logger.error('Failed to fetch/create user in database:', error);
      // Continue with default role
    }

    // Attach user information to request
    req.user = {
      id: dbUser?.id || null,
      clerkId: payload.sub,
      firstName: payload.given_name,
      lastName: payload.family_name,
      role: userRole
    };

    logger.debug('User authenticated:', {
      clerkId: req.user.clerkId,
      role: req.user.role
    });

    next();
  } catch (error) {
    logger.error('JWT authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Token has expired' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'Invalid token format' 
      });
    }

    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: 'Authentication failed' 
    });
  }
};

/**
 * Optional JWT Authentication Middleware
 * Similar to authenticateJWT but doesn't fail if no token is provided
 * Useful for endpoints that work with or without authentication
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      req.user = null;
      return next();
    }

    // Verify the JWT token with Clerk
    const payload = await verifyToken(token, {
      secretKey: config.clerk.secretKey
    });

    if (payload) {
      req.user = {
        clerkId: payload.sub,
        firstName: payload.given_name,
        lastName: payload.family_name,
        role: payload.metadata?.role || 'employee'
      };
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    logger.warn('Optional authentication failed:', error.message);
    req.user = null;
    next();
  }
};

export default {
  authenticateJWT,
  optionalAuth
};
