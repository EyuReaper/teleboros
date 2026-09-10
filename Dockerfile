# ==============================================================================
# Teleboros Production Multi-Stage Dockerfile
# ==============================================================================
FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ------------------------------------------------------------------------------
# 1. Install dependencies
# ------------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ------------------------------------------------------------------------------
# 2. Build the application
# ------------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set placeholder environment variables for static build if not provided
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm build

# ------------------------------------------------------------------------------
# 3. Production runner
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4321
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create persistent storage directories
RUN mkdir -p /app/data/posts /app/public/uploads && chown -R nextjs:nodejs /app/data /app/public/uploads

COPY --from=builder /app/public ./public

# Copy standalone output and static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 4321

CMD ["node", "server.js"]
