#!/usr/bin/env bash
# Quick start: spin up all infra + migrate + seed
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "🚀 Enterprise LMS — Quick Start"
echo ""

# 1. Check .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📄 .env created from .env.example — edit it before production!"
fi

# 2. Create data directories
mkdir -p deploy/data/{postgres,mongodb,redis,minio,qdrant,clickhouse,kafka,zookeeper}
echo "📁 Data directories ready"

# 3. Start infrastructure
echo ""
echo "🐳 Starting infrastructure..."
docker compose up -d postgres mongodb redis minio kafka qdrant clickhouse

# 4. Wait for postgres to be healthy
echo "⏳ Waiting for PostgreSQL..."
until docker compose exec postgres pg_isready -U postgres -d enterprise_lms > /dev/null 2>&1; do
  sleep 2
done
echo "✅ PostgreSQL ready"

# 5. Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 6. Generate Prisma client & migrate
echo ""
echo "🗄️  Running database migrations..."
cd packages/database
npx prisma generate
npx prisma migrate deploy
echo "✅ Migrations complete"

# 7. Seed data
echo ""
echo "🌱 Seeding sample data..."
pnpm db:seed
echo "✅ Seed complete"

cd "$ROOT"
echo ""
echo "════════════════════════════════════════"
echo "✅ Infrastructure ready!"
echo ""
echo "Run services:"
echo "  pnpm dev              # All services (Turborepo)"
echo ""
echo "Or individually:"
echo "  cd services/auth-service && pnpm dev   # PORT 3001"
echo "  cd services/learning-service && pnpm dev  # PORT 3002"
echo "  cd apps/web && pnpm dev               # PORT 3000"
echo ""
echo "Dev tools:"
echo "  docker compose --profile tools up -d  # Kafka UI :8080"
echo "  cd packages/database && npx prisma studio  # Prisma Studio :5555"
echo "════════════════════════════════════════"
