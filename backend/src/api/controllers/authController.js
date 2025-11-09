/**
 * Authentication Controller
 * Handles HTTP requests for authentication operations
 */

import { config } from '../../config/index.js';
import logger from '../../config/logger.js';

/**
 * Auth Controller class
 */
export class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  /**
   * Initiates Discord OAuth flow
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async discordAuth(req, res) {
    this.authService.passport.authenticate('discord')(req, res);
  }

  /**
   * Handles Discord OAuth callback
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async discordCallback(req, res) {
    this.authService.passport.authenticate('discord', {
      failureRedirect: '/?error=unauthorized',
      failureMessage: true
    })(req, res, () => {
      logger.info('CALLBACK User authenticated:', req.user.id);
      logger.info('CALLBACK Session before save:', req.session);
      
      req.session.save(err => {
        if (err) {
          logger.error('CALLBACK Session save error:', err);
          return res.status(500).json({ error: 'CALLBACK Failed to save session' });
        }
        
        logger.info('CALLBACK Session after save:', req.session);
        res.redirect(config.nodeEnv === 'production'
          ? 'https://panelvtp.xyz'
          : 'http://localhost:5173');
      });
    });
  }

  /**
   * Gets current user information
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async getUser(req, res) {
    logger.info('Auth user request:', req.user ? req.user.id : null);
    if (req.user) {
      res.json({ username: req.user.username || 'Unknown', id: req.user.id });
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  }

  /**
   * Logs out the current user
   * @param {Request} req - Express request
   * @param {Response} res - Express response
   */
  async logout(req, res) {
    res.setHeader('Access-Control-Allow-Origin', config.cors.origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    req.logout(err => {
      if (err) {
        logger.error('Logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      
      req.session.destroy(err => {
        if (err) {
          logger.error('Session destroy error:', err);
          return res.status(500).json({ error: 'Failed to destroy session' });
        }
        
        res.status(200).json({ message: 'Logged out successfully' });
      });
    });
  }
}

export default AuthController;
