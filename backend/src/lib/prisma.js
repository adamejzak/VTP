import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

// Enhanced Prisma configuration for production Docker environments
const prismaConfig = {
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // SQLite-specific optimizations for Docker
  ...(process.env.DATABASE_URL?.includes('sqlite') && {
    // Connection pool settings for SQLite
    __internal: {
      engine: {
        // Increase timeout for Docker environments
        connectTimeout: 60000, // 60 seconds
        // Enable WAL mode for better concurrency
        pragma: [
          'journal_mode=WAL',
          'synchronous=NORMAL',
          'cache_size=10000',
          'temp_store=MEMORY',
          'mmap_size=268435456' // 256MB
        ]
      }
    }
  })
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaConfig)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
