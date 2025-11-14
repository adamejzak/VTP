# Backend Dockerfile for Production
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# (Skip prisma generate in builder; will generate in runner)

# Production image, copy all the files and run the app
FROM base AS runner
ARG SPEEDTEST_VERSION=1.2.0
ARG SPEEDTEST_URI_BASE="https://install.speedtest.net/app/cli"
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# System deps required by Prisma engines + Speedtest CLI
RUN set -eux; \
  apk add --no-cache openssl libc6-compat curl; \
  arch="$(apk --print-arch)"; \
  case "$arch" in \
    x86_64) speedtest_pkg="ookla-speedtest-${SPEEDTEST_VERSION}-linux-x86_64.tgz" ;; \
    aarch64) speedtest_pkg="ookla-speedtest-${SPEEDTEST_VERSION}-linux-aarch64.tgz" ;; \
    *) echo "Unsupported arch for Speedtest CLI: ${arch}" >&2; exit 1 ;; \
  esac; \
  curl -fsSL "${SPEEDTEST_URI_BASE}/${speedtest_pkg}" -o /tmp/speedtest.tgz; \
  tar -xzf /tmp/speedtest.tgz -C /tmp; \
  install -m 755 /tmp/speedtest /usr/local/bin/speedtest; \
  rm -f /tmp/speedtest.tgz /tmp/speedtest.md; \
  speedtest --version

# Copy built application
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/production.config.js ./

# Create necessary directories before ownership change
RUN mkdir -p data logs

# Ensure app files are owned by non-root user
RUN chown -R nodejs:nodejs /app

# Ensure logs directory has correct permissions
RUN chown -R nodejs:nodejs /app/logs && chmod 755 /app/logs

# Generate Prisma client in production image (as non-root)
USER nodejs
RUN npx --yes prisma generate || (chmod +x node_modules/.bin/prisma && npx --yes prisma generate)

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "src/index.js"]

