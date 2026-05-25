# syntax=docker/dockerfile:1

# ── Base ──────────────────────────────────────────────────────────────────────
FROM node:20-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `npm run build` runs `prisma generate && next build`
RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# System Chromium for puppeteer-core (no cold-start binary unpacking) +
# CJK fonts so Korean card copy renders correctly in the screenshot.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       chromium \
       fonts-noto-cjk \
       ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Next.js standalone output (server + minimal traced node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma generated client (dynamic require not always picked up by tracing)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
