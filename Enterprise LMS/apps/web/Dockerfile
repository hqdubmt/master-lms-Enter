# syntax=docker/dockerfile:1
# ── Next.js web app — standalone output ─────────────────────────────────────

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# ── Stage 1: install dependencies ───────────────────────────────────────────
FROM base AS installer
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/types/package.json packages/types/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY apps/web/package.json        apps/web/package.json

RUN pnpm install --frozen-lockfile

# ── Stage 2: build ──────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=installer /app ./

COPY tsconfig.base.json ./
COPY packages/types packages/types
COPY packages/utils packages/utils
COPY apps/web        apps/web

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @lms/types build && \
    pnpm --filter @lms/utils build && \
    pnpm --filter @lms/web build

# ── Stage 3: minimal runner ──────────────────────────────────────────────────
# standalone output contains its own node_modules copy — no pnpm needed
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# standalone dir is self-contained (server.js + minimal node_modules)
COPY --from=builder /app/apps/web/.next/standalone ./
# Static assets are NOT included in standalone — must copy separately
COPY --from=builder /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder /app/apps/web/public           ./apps/web/public

EXPOSE 3000
CMD ["node", "server.js"]
