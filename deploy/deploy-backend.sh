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

# Chờ dịch vụ có healthcheck lên hẳn: core (tối đa 5 phút), rồi API gateway
# (giao diện gọi qua gateway, gateway chỉ healthy khi gọi được core).
wait_healthy() {
    local service=$1 tries=$2 id status=starting
    id=$(docker compose ps -q "$service")
    for _ in $(seq 1 "$tries"); do
        status=$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || echo starting)
        [ "$status" = healthy ] && return 0
        sleep 5
    done
    echo "$service chưa healthy (trạng thái: $status)" >&2
    docker compose logs --tail 80 "$service" >&2
    return 1
}
wait_healthy core-service 60
if [[ " $SERVICES " == *" api-gateway "* ]]; then
    wait_healthy api-gateway 24
    # Gateway kiểm tra token bằng JWT_SECRET: lệch với core thì mọi request bị 401.
    # So bằng mã băm để không in khoá ra log.
    core_key=$(docker compose exec -T core-service printenv JWT_SECRET | sha256sum)
    gateway_key=$(docker compose exec -T api-gateway printenv JWT_SECRET | sha256sum)
    if [ "$core_key" != "$gateway_key" ]; then
        echo "JWT_SECRET của api-gateway khác core-service: đặt cùng giá trị (biến JWT_SECRET trong .env)" >&2
        exit 1
    fi
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
