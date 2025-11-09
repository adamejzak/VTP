/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Fix for multiple lockfiles warning
  outputFileTracingRoot: __dirname,
  
  images: {
    domains: ['cdn.discordapp.com', 'images.clerk.dev'],
  },
  env: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_VERSION: process.env.FRONTEND_VERSION || process.env.APP_VERSION || process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
  },
}

module.exports = nextConfig
