#!/usr/bin/env bash
# Stop all services and infrastructure
# Usage: ./stop.sh           → stop PM2 + infra
#        ./stop.sh --docker  → stop Docker app containers + infra
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

MODE="local"
if [ "${1}" = "--docker" ]; then MODE="docker"; fi

echo "🛑 Stopping Enterprise LMS...  [${MODE} mode]"

if [ "$MODE" = "local" ]; then
  echo "  Stopping PM2 services..."
  npx pm2 stop ecosystem.config.js 2>/dev/null || true
  npx pm2 delete ecosystem.config.js 2>/dev/null || true
fi

if [ "$MODE" = "docker" ]; then
  echo "  Stopping app containers..."
  docker compose -f docker-compose.yml -f docker-compose.prod.yml down \
    --remove-orphans 2>/dev/null || true
fi

echo "  Stopping infrastructure..."
docker compose down

echo "✅ All stopped."
