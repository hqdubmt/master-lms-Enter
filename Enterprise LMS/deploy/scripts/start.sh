#!/usr/bin/env bash
# One-command deploy: infra → migrate → seed → build → start all services
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "🚀 Enterprise LMS — Full Deploy"
echo ""

# ── 1. Check .env ────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📄 .env created from .env.example — edit it before production!"
fi

# ── 2. Create required directories ──────────────────────────────────────────
mkdir -p deploy/data/{postgres,mongodb,redis,minio,qdrant,clickhouse,kafka,zookeeper}
mkdir -p logs
echo "📁 Directories ready"

# ── 3. Start infrastructure ──────────────────────────────────────────────────
echo ""
echo "🐳 Starting infrastructure..."
docker compose up -d postgres mongodb redis minio kafka qdrant clickhouse

# ── 4. Wait for PostgreSQL ────────────────────────────────────────────────────
echo "⏳ Waiting for PostgreSQL..."
until docker compose exec postgres pg_isready -U postgres -d enterprise_lms > /dev/null 2>&1; do
  sleep 2
done
echo "✅ PostgreSQL ready"

# ── 5. Wait for MongoDB ───────────────────────────────────────────────────────
echo "⏳ Waiting for MongoDB..."
until docker compose exec mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
  sleep 2
done
echo "✅ MongoDB ready"

# ── 6. Wait for Redis ─────────────────────────────────────────────────────────
echo "⏳ Waiting for Redis..."
until docker compose exec redis redis-cli ping > /dev/null 2>&1; do
  sleep 2
done
echo "✅ Redis ready"

# ── 7. Install dependencies ───────────────────────────────────────────────────
echo ""
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ── 8. Generate Prisma client & migrate ──────────────────────────────────────
echo ""
echo "🗄️  Running database migrations..."
cd packages/database
npx prisma generate
npx prisma migrate deploy
cd "$ROOT"
echo "✅ Migrations complete"

# ── 9. Seed data ──────────────────────────────────────────────────────────────
echo ""
echo "🌱 Seeding sample data..."
pnpm db:seed
echo "✅ Seed complete"

# ── 10. Build all services ────────────────────────────────────────────────────
echo ""
echo "🔨 Building all services..."
pnpm build
echo "✅ Build complete"

# ── 11. Stop any running PM2 instances ───────────────────────────────────────
echo ""
echo "🔄 Restarting services with PM2..."
npx pm2 stop ecosystem.config.js 2>/dev/null || true
npx pm2 delete ecosystem.config.js 2>/dev/null || true

# ── 12. Start all services with PM2 ──────────────────────────────────────────
npx pm2 start ecosystem.config.js
npx pm2 save

# ── 13. Done ─────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Enterprise LMS is running!"
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
echo ""
echo "  MinIO Console   → http://localhost:9001"
echo ""
echo "Useful commands:"
echo "  pnpm logs                 # View all service logs"
echo "  npx pm2 monit             # Live process monitor"
echo "  npx pm2 logs <name>       # Logs for a specific service"
echo "  ./deploy/scripts/stop.sh  # Stop everything"
echo "════════════════════════════════════════════════════════════"
