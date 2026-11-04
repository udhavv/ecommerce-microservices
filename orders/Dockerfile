# ==============================================================================
# Production Dockerfile for Order Microservice
# Multi-stage build for minimal attack surface and small image size
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies Builder
# ------------------------------------------------------------------------------
FROM node:26-alpine AS deps

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev --ignore-scripts

# ------------------------------------------------------------------------------
# Stage 2: Production Runner
# ------------------------------------------------------------------------------
FROM node:26-alpine AS runner

WORKDIR /app

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=4003

# Install lightweight utility for container health checks
RUN apk add --no-cache wget

# Copy production dependencies from deps stage
COPY --chown=node:node --from=deps /app/node_modules ./node_modules

# Copy application source code and database migrations
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node database ./database

# Run as non-privileged node user for security
USER node

# Expose microservice port
EXPOSE 4003

# Container healthcheck querying the order /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4003/health || exit 1

# Start the order service
CMD ["node", "src/index.js"]
