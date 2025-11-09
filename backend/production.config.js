/**
 * Production Configuration
 * This file contains production-specific settings
 */

export const productionConfig = {
  // Server settings
  port: 8080,
  nodeEnv: 'production',
  
  // CORS settings for production
  cors: {
    origin: ['https://panelvtp.xyz', 'https://www.panelvtp.xyz'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  },
  
  // Session settings for production
  session: {
    secure: true,
    sameSite: 'none',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  },
  
  // Logging settings
  logging: {
    level: 'info',
    format: 'json'
  },
  
  // Security settings
  security: {
    trustProxy: true,
    helmet: true
  }
};

export default productionConfig;
