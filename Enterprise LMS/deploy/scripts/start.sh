#!/usr/bin/env bash
# One-command deploy — two modes:
#   ./start.sh          → local (PM2, build from source)
#   ./start.sh --docker → production (pull Docker Hub images)
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

MODE="local"
if [ "${1}" = "--docker" ]; then MODE="docker"; fi

echo "🚀 Enterprise LMS — Full Deploy  [mode: ${MODE}]"
echo ""

# ── 1. Check .env ────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📄 .env created from .env.example — edit before production!"
fi

# ── 2. Create required directories ──────────────────────────────────────────
mkdir -p deploy/data/{postgres,mongodb,redis,minio,qdrant,clickhouse,kafka,zookeeper}
mkdir -p logs
echo "📁 Directories ready"

# ── 3. Start infrastructure ──────────────────────────────────────────────────
echo ""
echo "🐳 Starting infrastructure..."
docker compose up -d postgres mongodb redis minio kafka qdrant clickhouse

# ── 4. Wait for databases ─────────────────────────────────────────────────────
echo "⏳ Waiting for PostgreSQL..."
until docker compose exec postgres pg_isready -U postgres -d enterprise_lms > /dev/null 2>&1; do
  sleep 2
done
echo "✅ PostgreSQL ready"

echo "⏳ Waiting for MongoDB..."
until docker compose exec mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
  sleep 2
done
echo "✅ MongoDB ready"

echo "⏳ Waiting for Redis..."
until docker compose exec redis redis-cli ping > /dev/null 2>&1; do
  sleep 2
done
echo "✅ Redis ready"

# ── 5. Install dependencies & run migrations ─────────────────────────────────
echo ""
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo ""
echo "🗄️  Running database migrations..."
cd packages/database
npx prisma generate
npx prisma migrate deploy
cd "$ROOT"
echo "✅ Migrations complete"

echo ""
echo "🌱 Seeding sample data..."
pnpm db:seed
echo "✅ Seed complete"

# ── 6a. LOCAL mode: build source + PM2 ───────────────────────────────────────
if [ "$MODE" = "local" ]; then
  echo ""
  echo "🔨 Building all services..."
  pnpm build
  echo "✅ Build complete"

  echo ""
  echo "🔄 Starting services with PM2..."
  npx pm2 stop ecosystem.config.js 2>/dev/null || true
  npx pm2 delete ecosystem.config.js 2>/dev/null || true
  npx pm2 start ecosystem.config.js
  npx pm2 save
fi

# ── 6b. DOCKER mode: pull images from Docker Hub ─────────────────────────────
if [ "$MODE" = "docker" ]; then
  echo ""
  echo "⬇️  Pulling images from Docker Hub..."
  docker compose -f docker-compose.yml -f docker-compose.prod.yml pull \
    auth-service learning-service ai-service analytics-service \
    notification-service game-service media-service realtime-gateway web

  echo ""
  echo "🔄 Starting app containers..."
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d \
    auth-service learning-service ai-service analytics-service \
    notification-service game-service media-service realtime-gateway web
fi

# ── 7. Done ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Enterprise LMS is running!  [${MODE} mode]"
echo ""
echo "  Web App         → http://localhost:3000"
echo "  Auth Service    → http://localhost:3001"
echo "  Learning        → http://localhost:3002"
echo "  AI              → http://localhost:3003"
echo "  Analytics       → http://localhost:3004"
echo "  Notifications   → http://localhost:3005"
echo "  Game            → http://localhost:3006"
echo "  Media           → http://localhost:3007"
echo "  Realtime        → ws://localhost:3008"
echo "  MinIO Console   → http://localhost:9001"
echo ""
if [ "$MODE" = "local" ]; then
echo "  pnpm logs                 # View all logs"
echo "  npx pm2 monit             # Live monitor"
else
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
fi
echo "  ./deploy/scripts/stop.sh  # Stop everything"
echo "════════════════════════════════════════════════════════════"
