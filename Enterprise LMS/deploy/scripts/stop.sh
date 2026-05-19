#!/usr/bin/env bash
# Stop all services and infrastructure
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "🛑 Stopping Enterprise LMS..."

# Stop Node.js services
echo "  Stopping application services..."
npx pm2 stop ecosystem.config.js 2>/dev/null || true
npx pm2 delete ecosystem.config.js 2>/dev/null || true

# Stop Docker infrastructure
echo "  Stopping infrastructure..."
docker compose down

echo "✅ All stopped."
