/**
 * Main configuration file
 * Centralizes all application configuration
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : '.env.development';

// Load the environment-specific file
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Also load .env as fallback (for Prisma compatibility)
dotenv.config();

/**
 * Application configuration object
 */
export const config = {
  // Server configuration
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Discord configuration
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    maxListeners: 15
  },
  
  // Database configuration
  database: {
    url: process.env.DATABASE_URL || 'file:./prisma/database.sqlite'
  },
  
  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  },
  
  // CORS configuration
  cors: {
    // Allow override via env: CORS_ORIGINS (comma-separated) or CORS_ORIGIN (single)
    origin: (() => {
      const fromEnv = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN;
      if (fromEnv) {
        return fromEnv.split(',').map(o => o.trim()).filter(Boolean);
      }
      if (process.env.NODE_ENV === 'production') {
        // Default production allowlist
        return [
          'https://panelvtp.xyz',
          'https://www.panelvtp.xyz'
        ];
      }
      // Default development origin
      return ['http://localhost:3000'];
    })(),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  },
  
  // Task configuration
  tasks: {
    checkInterval: 60 * 1000, // 1 minute
    priorityIntervals: {
      low: 4 * 60 * 60 * 1000,   
      medium: 2 * 60 * 60 * 1000, 
      high: 1 * 60 * 60 * 1000   
    },
    priorityTranslation: {
      low: '🟢 Niski',
      medium: '🟠 Średni',
      high: '🔴 Wysoki'
    }
  },
  
  // Bot presence configuration (deprecated - now managed via panel)
  // botPresence: {
  //   activity: 'antoni w wannie',
  //   type: 'WATCHING'
  // },
  
  // Clerk configuration
  clerk: {
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    jwtKey: process.env.CLERK_JWT_KEY
  }
  
};

export default config;
