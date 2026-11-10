# API gateway

Cổng vào duy nhất của MeetingMind. Giao diện (Next.js) chuyển mọi request `/api/*`
tới đây; gateway kiểm tra rồi chuyển tiếp nguyên luồng tới `core-service`.

| Việc | Cách làm |
|---|---|
| Kiểm tra token | Access token (JWT, HS256) phải đúng chữ ký và còn hạn, ký bằng cùng `JWT_SECRET` với core. Sai thì trả 401 cùng dạng lỗi của core để giao diện tự làm mới phiên. Phân quyền nghiệp vụ vẫn ở core. |
| Route công khai | `POST /auth/{login,register,refresh,logout,google}`, `GET /auth/{providers,invite}`, `GET /app/timestamp`. |
| Chặn kênh nội bộ | `/microservice/*`, `/internal/*` chỉ gọi trong mạng Docker, từ ngoài trả 404. |
| Giới hạn tần suất | Đăng nhập, đăng ký: `GATEWAY_AUTH_RATE_LIMIT` lần/phút mỗi IP. Còn lại: `GATEWAY_RATE_LIMIT` lần/phút mỗi người dùng (chưa đăng nhập thì mỗi IP). Vượt thì 429 kèm `Retry-After`. Đếm trong bộ nhớ, đủ cho một instance. |
| Chuyển tiếp | Không đọc body vào bộ nhớ (tệp ghi âm lớn đi thẳng), giữ query và header, thêm `X-Forwarded-*`, gắn `X-Request-Id` để dò log. Core không trả lời thì 502, quá `GATEWAY_UPSTREAM_TIMEOUT_MS` thì 504. |
| Health | `GET /gateway/health`: 200 khi gọi được core, 503 khi không. Docker healthcheck dùng route này. |

## Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `SERVER_PORT` | `3000` | Cổng nghe |
| `CORE_SERVICE_URL` | `http://localhost:3010` | Địa chỉ core-service |
| `JWT_SECRET` | (bắt buộc) | Trùng core-service |
| `GATEWAY_RATE_LIMIT` | `600` | Request/phút mỗi người dùng |
| `GATEWAY_AUTH_RATE_LIMIT` | `20` | Lần đăng nhập/đăng ký mỗi phút mỗi IP |
| `GATEWAY_RATE_WINDOW_MS` | `60000` | Độ dài cửa sổ đếm |
| `GATEWAY_UPSTREAM_TIMEOUT_MS` | `300000` | Thời gian chờ core im lặng tối đa |
| `GATEWAY_TRUST_PROXY` | `loopback, linklocal, uniquelocal` | Proxy phía trước được tin để lấy IP thật |

## Chạy

```bash
npm ci
npm test          # test với một core giả
npm run start:dev # cần core-service ở CORE_SERVICE_URL và JWT_SECRET
```

Trong `docker-compose.yml` gateway nghe cổng 3000; `meeting-mind-fe` đặt `MM_API_URL`
(mặc định `http://localhost:3000`) để `/api` đi qua gateway.
