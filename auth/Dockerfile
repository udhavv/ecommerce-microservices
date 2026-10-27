# ==============================================================================
# Production Dockerfile for Auth Microservice
# Multi-stage build for minimal image size and enhanced security
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies Builder
# ------------------------------------------------------------------------------
FROM node:26-alpine AS deps

# Install build dependencies for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package specifications
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev --ignore-scripts && npm rebuild bcrypt --build-from-source

# ------------------------------------------------------------------------------
# Stage 2: Production Runner
# ------------------------------------------------------------------------------
FROM node:26-alpine AS runner

WORKDIR /app

# Production environment variables
ENV NODE_ENV=production
ENV PORT=4000

# Install runtime dependencies for health checks
RUN apk add --no-cache wget

# Copy production node_modules from deps stage
COPY --chown=node:node --from=deps /app/node_modules ./node_modules

# Copy application source code
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node database ./database

# Run as non-privileged node user for security
USER node

# Expose microservice port
EXPOSE 4000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Start the auth service
CMD ["node", "src/index.js"]
