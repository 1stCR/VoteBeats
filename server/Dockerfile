# =============================================================================
# VoteBeats API Server - Docker Image
# =============================================================================
# Multi-stage build for smaller production image
# Uses node:18-alpine with native module support for better-sqlite3
# =============================================================================

# --- Build Stage ---
FROM node:18-alpine AS builder

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# --- Production Stage ---
FROM node:18-alpine

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache libstdc++

WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY . .

# Create data directory for SQLite database persistence
# In Cloud Run, mount a persistent volume at /app/data
RUN mkdir -p /app/data

# Environment variables (override at deploy time)
ENV NODE_ENV=production
ENV PORT=8080

# Cloud Run expects the container to listen on PORT
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

# Start the server
CMD ["node", "index.js"]
