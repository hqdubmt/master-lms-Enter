#!/usr/bin/env bash
# Reset: xoá toàn bộ data và seed lại từ đầu
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "⚠️  WARNING: This will delete ALL data in deploy/data/"
read -p "Are you sure? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "🛑 Stopping containers..."
docker compose down

echo "🗑️  Removing data..."
rm -rf deploy/data/postgres deploy/data/mongodb deploy/data/redis \
        deploy/data/minio deploy/data/kafka deploy/data/qdrant \
        deploy/data/clickhouse deploy/data/zookeeper

echo "✅ Data cleared. Run ./deploy/scripts/start.sh to rebuild."
