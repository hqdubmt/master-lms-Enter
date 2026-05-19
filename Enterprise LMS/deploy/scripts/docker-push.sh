#!/usr/bin/env bash
# Build and push all Docker images to Docker Hub (hqdu)
# Usage: ./deploy/scripts/docker-push.sh [tag]   (default: latest)
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

REGISTRY="hqdu"
TAG="${1:-latest}"

echo "🐳 Building & pushing Enterprise LMS images (tag: ${TAG})"
echo ""

# ── Backend services ──────────────────────────────────────────────────────────
declare -A SERVICES=(
  ["auth-service"]="3001"
  ["learning-service"]="3002"
  ["ai-service"]="3003"
  ["analytics-service"]="3004"
  ["notification-service"]="3005"
  ["game-service"]="3006"
  ["media-service"]="3007"
  ["realtime-gateway"]="3008"
)

# Short image names (without -service suffix for brevity)
declare -A IMAGE_NAMES=(
  ["auth-service"]="lms-auth"
  ["learning-service"]="lms-learning"
  ["ai-service"]="lms-ai"
  ["analytics-service"]="lms-analytics"
  ["notification-service"]="lms-notification"
  ["game-service"]="lms-game"
  ["media-service"]="lms-media"
  ["realtime-gateway"]="lms-realtime"
)

for SERVICE in "${!SERVICES[@]}"; do
  PORT="${SERVICES[$SERVICE]}"
  IMAGE="${REGISTRY}/${IMAGE_NAMES[$SERVICE]}:${TAG}"

  echo "────────────────────────────────────────"
  echo "📦 Building: ${IMAGE}  (${SERVICE}:${PORT})"

  docker build \
    --build-arg SERVICE_NAME="${SERVICE}" \
    --build-arg SERVICE_PORT="${PORT}" \
    --tag "${IMAGE}" \
    --file Dockerfile \
    .

  echo "⬆️  Pushing: ${IMAGE}"
  docker push "${IMAGE}"
  echo "✅ Done: ${IMAGE}"
  echo ""
done

# ── Next.js web ───────────────────────────────────────────────────────────────
WEB_IMAGE="${REGISTRY}/lms-web:${TAG}"
echo "────────────────────────────────────────"
echo "📦 Building: ${WEB_IMAGE}"

docker build \
  --tag "${WEB_IMAGE}" \
  --file apps/web/Dockerfile \
  .

echo "⬆️  Pushing: ${WEB_IMAGE}"
docker push "${WEB_IMAGE}"
echo "✅ Done: ${WEB_IMAGE}"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ All images pushed to Docker Hub (tag: ${TAG})"
echo ""
echo "  hqdu/lms-auth:${TAG}"
echo "  hqdu/lms-learning:${TAG}"
echo "  hqdu/lms-ai:${TAG}"
echo "  hqdu/lms-analytics:${TAG}"
echo "  hqdu/lms-notification:${TAG}"
echo "  hqdu/lms-game:${TAG}"
echo "  hqdu/lms-media:${TAG}"
echo "  hqdu/lms-realtime:${TAG}"
echo "  hqdu/lms-web:${TAG}"
echo ""
echo "Pull anywhere:"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
echo "════════════════════════════════════════════════════════════"
