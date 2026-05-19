# syntax=docker/dockerfile:1
# ── Multi-stage Dockerfile for all backend services ─────────────────────────
# Build:  docker build --build-arg SERVICE_NAME=auth-service --build-arg SERVICE_PORT=3001 -t hqdu/lms-auth:latest .

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# ── Stage 1: install dependencies ───────────────────────────────────────────
FROM base AS installer
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Workspace package manifests (for pnpm to resolve workspaces)
COPY packages/database/package.json  packages/database/package.json
COPY packages/types/package.json     packages/types/package.json
COPY packages/utils/package.json     packages/utils/package.json

# Service manifests
COPY services/auth-service/package.json          services/auth-service/package.json
COPY services/learning-service/package.json      services/learning-service/package.json
COPY services/ai-service/package.json            services/ai-service/package.json
COPY services/analytics-service/package.json     services/analytics-service/package.json
COPY services/notification-service/package.json  services/notification-service/package.json
COPY services/game-service/package.json          services/game-service/package.json
COPY services/media-service/package.json         services/media-service/package.json
COPY services/realtime-gateway/package.json      services/realtime-gateway/package.json

RUN pnpm install --frozen-lockfile

# ── Stage 2: build all services ─────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=installer /app ./

# Source code
COPY tsconfig.base.json turbo.json ./
COPY packages packages
COPY services services

# Generate Prisma client (alpine-compatible binary)
RUN cd packages/database && npx prisma generate

# Build all services (turbo handles dependency order)
RUN pnpm build

# ── Stage 3: minimal production image ───────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

ARG SERVICE_NAME
ARG SERVICE_PORT=3000

# pnpm symlinks: node_modules/@lms/* → ../../packages/*
# Both must be present for symlinks to resolve
COPY --from=builder /app/node_modules                  ./node_modules
COPY --from=builder /app/packages/database/dist        ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder /app/packages/types/dist           ./packages/types/dist
COPY --from=builder /app/packages/types/package.json   ./packages/types/package.json
COPY --from=builder /app/packages/utils/dist           ./packages/utils/dist
COPY --from=builder /app/packages/utils/package.json   ./packages/utils/package.json

# Service dist — resolved at build time via ARG
COPY --from=builder /app/services/${SERVICE_NAME}/dist ./dist

EXPOSE ${SERVICE_PORT}
CMD ["node", "dist/index.js"]
