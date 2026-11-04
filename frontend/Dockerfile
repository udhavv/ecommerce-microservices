# ==============================================================================
# Production Multi-Stage Dockerfile for Frontend (Next.js)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Install dependencies
# ------------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci

# ------------------------------------------------------------------------------
# Stage 2: Build the Next.js application
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Provide build-time fallback API URLs
ENV NEXT_PUBLIC_AUTH_API_URL=/api/auth
ENV NEXT_PUBLIC_PRODUCT_API_URL=/api
ENV NEXT_PUBLIC_INVENTORY_API_URL=/api
ENV NEXT_PUBLIC_ORDER_API_URL=/api
ENV NEXT_PUBLIC_PAYMENT_API_URL=/api
ENV NEXT_PUBLIC_REVIEW_API_URL=/api

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Production Runner
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs
EXPOSE 3000

CMD ["npm", "start"]
