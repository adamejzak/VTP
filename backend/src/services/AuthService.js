/**
 * Authentication Service
 * Handles Discord OAuth authentication and session management
 */

import DiscordStrategy from 'passport-discord';
import { config } from '../config/index.js';
import logger from '../config/logger.js';

/**
 * Service for handling authentication
 */
export class AuthService {
  constructor(passport) {
    this.passport = passport;
    this.whitelist = config.auth.whitelist;
    this.setupPassport();
  }

  /**
   * Sets up Passport.js with Discord strategy
   */
  setupPassport() {
    this.passport.use(new DiscordStrategy({
      clientID: config.discord.clientId,
      clientSecret: config.discord.clientSecret,
      callbackURL: config.nodeEnv === 'production'
        ? 'https://panelvtp.xyz/auth/discord/callback'
        : 'http://localhost:3000/auth/discord/callback',
      scope: ['identify', 'guilds']
    }, (accessToken, refreshToken, profile, done) => {
      logger.info('Discord profile:', profile.id);
      // Check if user's Discord ID is in the whitelist
      if (!this.whitelist.includes(profile.id)) {
        logger.warn('User not in whitelist:', profile.id);
        return done(null, false, { message: 'Nie jesteś administratorem!' });
      }
      return done(null, profile);
    }));

    // Serialize only the user ID
    this.passport.serializeUser((user, done) => {
      logger.info('Serializing user:', user.id);
      done(null, user.id);
    });

    // Deserialize by fetching user data
    this.passport.deserializeUser((id, done) => {
      logger.info('Deserializing user:', id);
      const user = { id }; // Replace with actual user lookup if needed
      done(null, user);
    });
  }

  /**
   * Sets up authentication routes
   * @param {Express} app - Express app instance
   */
  setupRoutes(app) {
    app.get('/auth/discord', this.passport.authenticate('discord'));

    app.get('/auth/discord/callback',
      this.passport.authenticate('discord', {
        failureRedirect: '/?error=unauthorized',
        failureMessage: true
      }),
      (req, res) => {
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
      }
    );

    app.get('/auth/user', (req, res) => {
      logger.info('Auth user request:', req.user ? req.user.id : null);
      if (req.user) {
        res.json({ username: req.user.username || 'Unknown', id: req.user.id });
      } else {
        res.status(401).json({ error: 'Not authenticated' });
      }
    });

    app.get('/auth/logout', (req, res, next) => {
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
    });
  }
}

export default AuthService;
