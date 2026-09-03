# MeetingMind — Kiến trúc tổng quan (MVP)

Bản tóm tắt này phản ánh đề xuất: gom các service logic thành ~6 service deploy độc lập cho phiên bản MVP.

Các folder chính:

- `frontend/` — Next.js (UI, realtime, WebSocket)
- `api-gateway/` — NestJS (auth, routing, WebSocket, rate-limit)
- `core-service/` — NestJS (modules: auth, user, workspace, project, meeting, task, review)
- `integration-service/` — NestJS (Jira/Trello/Slack/Google Calendar integrations)
- `bot-worker/` — Python worker (Playwright, capture audio)
- `ai-service/` — FastAPI (transcript, summary, action_item, risk, rag)
- `infrastructure/` — Docker Compose, Postgres, RabbitMQ, Redis, MinIO, monitoring

Kiến trúc tóm tắt (MVP):

- Giao tiếp sync: HTTPS / WebSocket qua `api-gateway` (NestJS)
- Giao tiếp async: RabbitMQ cho các event/job nền (meeting.created, transcript.completed, ai.completed, ...)
- Lưu trữ chính: PostgreSQL (extension: pgvector cho RAG)
- Object storage: MinIO (dev) → S3/R2 cho production
- Cache/session: Redis
- Observability: Prometheus + Grafana + Loki + OpenTelemetry

Lý do gom nhóm:

- Tránh tạo 10 repo/service ngay từ đầu — gây overhead vận hành.
- `core-service` chứa nhiều module nghiệp vụ, dễ tách sau này nếu cần scale.
- `ai-service` gom các module AI; nếu một module (ví dụ transcript) cần GPU scale thì tách thành `transcript-service` sau.

Chiến lược triển khai MVP:

1. Bắt đầu với 5–6 process deploy độc lập: `api-gateway`, `core-service`, `integration-service`, `bot-worker`, `ai-service`, `frontend`.
2. Dùng Docker Compose để dev/run local. Chuyển sang Kubernetes khi cần scale.
3. Dùng RabbitMQ để kết nối các worker và event-driven flow.
4. Lưu embeddings trong Postgres + `pgvector` — không cần Pinecone/Milvus cho MVP.

Tài liệu chi tiết hơn (modules, stack, events, db schemas) nằm trong repo con hoặc có thể mở rộng khi bạn muốn scaffold tiếp.

---
Nếu bạn muốn, tôi có thể:

- Scaffold thư mục + README/boilerplate cho từng service.
- Sinh `docker-compose.dev.yml` trong `infrastructure/` để chạy Postgres/Redis/RabbitMQ/MinIO và placeholder services.
- Di chuyển hoặc tidy code hiện có vào cấu trúc mới (cần PR/backup).

Hãy chọn bước tiếp theo (scaffold / tạo docker-compose / refactor code).
