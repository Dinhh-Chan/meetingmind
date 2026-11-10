#!/usr/bin/env bash
# Build lại và khởi động lại backend trên máy chủ, từ commit đang checkout.
#
#   bash deploy/deploy-backend.sh
#
# GitHub Actions (.github/workflows/deploy.yml) gọi script này trên self-hosted
# runner sau khi đưa thư mục repo trên máy chủ về đúng commit vừa push.
# Chỉ dịch vụ có thay đổi mới được build và tạo lại container; dữ liệu nằm trong
# volume nên không mất. .env và docker-compose.override.yml của máy chủ không nằm
# trong git, không bị đụng tới.
set -euo pipefail
cd "$(dirname "$0")/.."

# Prometheus, Grafana chưa cấu hình thu thập nên mặc định không chạy (đỡ RAM).
SERVICES=${DEPLOY_SERVICES:-"postgres redis rabbitmq minio core-service api-gateway integration-service ai-service ai-worker bot-worker"}
# shellcheck disable=SC2086
docker compose up -d --build --remove-orphans $SERVICES

# Core là dịch vụ duy nhất có healthcheck nghiệp vụ; chờ tối đa 5 phút.
core=$(docker compose ps -q core-service)
for _ in $(seq 1 60); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$core" 2>/dev/null || echo starting)
    [ "$status" = healthy ] && break
    sleep 5
done
if [ "$status" != healthy ]; then
    echo "core-service chưa healthy sau 5 phút (trạng thái: $status)" >&2
    docker compose logs --tail 80 core-service >&2
    exit 1
fi

# Container nào khởi động lại liên tục là lỗi, dù core đã lên.
sleep 10
# shellcheck disable=SC2086
bad=$(docker compose ps --format '{{.Service}} {{.State}}' $SERVICES | awk '$2 != "running" {print $1}')
if [ -n "$bad" ]; then
    echo "Dịch vụ không chạy: $bad" >&2
    for s in $bad; do docker compose logs --tail 40 "$s" >&2; done
    exit 1
fi

# Bỏ image cũ không còn container nào dùng, tránh đầy đĩa sau nhiều lần build.
docker image prune -f >/dev/null
docker compose ps --format 'table {{.Service}}\t{{.State}}\t{{.Status}}' $SERVICES
