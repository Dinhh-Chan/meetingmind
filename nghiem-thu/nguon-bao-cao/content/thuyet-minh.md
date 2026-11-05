#### 1. Tên sản phẩm và dạng sản phẩm

**MeetingMind** — hệ thống trợ lý cuộc họp tự động hoá ghi biên bản và quản lý công việc sau họp (sản phẩm của đề tài "Thiết kế và triển khai hệ thống Meet-Assistant", mã số 18-SV-2026-RIPT). Dạng sản phẩm: chương trình máy tính, gồm ứng dụng web, các dịch vụ nền và tiện ích mở rộng trình duyệt Chrome.

#### 2. Chức năng chính

- **Thu nhận nội dung cuộc họp theo ba cách:** tải tệp ghi âm lên; mời bot tự tham gia phòng Google Meet để ghi âm (bot dùng tài khoản Google riêng, chờ người tổ chức cho vào, tự rời khi phòng trống); hoặc dùng tiện ích Chrome đọc phụ đề Google Meet mà không cần bot.
- **Phiên âm tiếng Việt và xen tiếng Anh:** Whisper chạy trên máy chủ, nhận diện ngôn ngữ cho từng đoạn, lọc câu bịa ở đoạn lặng hoặc nhiễu; tách người nói tự động ("Người nói 1, 2…") và cho phép gán tên thật.
- **Biên bản và công việc do AI đề xuất:** LLM (FPT AI Factory, DeepSeek-V4.1-Flash, dự phòng GLM-5.2) tóm tắt cuộc họp, tách quyết định, vấn đề còn mở và công việc kèm người thực hiện, thời hạn nguyên văn, mức ưu tiên, độ tin cậy và câu trích dẫn làm bằng chứng.
- **Con người duyệt trước khi giao việc:** đề xuất của AI vào hàng đợi duyệt; trưởng nhóm sửa, duyệt hoặc từ chối; chỉ mục đã duyệt mới thành công việc, quyết định chính thức. Transcript và biên bản lưu theo phiên bản.
- **Đồng bộ Trello và báo Telegram:** công việc đã duyệt được tự động tạo thành thẻ Trello (kèm người thực hiện, hạn, ưu tiên, câu trích nguồn) và báo qua bot Telegram; chống tạo thẻ trùng khi thử lại; kết quả hiện trên ngăn chi tiết công việc.
- **Hỏi đáp tri thức cuộc họp (RAG):** hỏi bằng tiếng Việt trên transcript, biên bản, quyết định, công việc và tài liệu đính kèm; câu trả lời kèm trích dẫn tới đúng cuộc họp, thời điểm, thiếu nguồn thì trả "chưa đủ thông tin"; chỉ tìm trong các cuộc họp người hỏi được xem.
- **Quản lý công việc và cộng tác:** workspace, dự án, thành viên; bảng công việc, bình luận, cảnh báo quá hạn trên giao diện; phân quyền theo vai trò ở từng phạm vi (54 quyền).

#### 3. Kiến trúc và công nghệ

Hệ thống gồm core-service (NestJS, PostgreSQL) điều phối nghiệp vụ; ai-worker (Python, faster-whisper, sherpa-onnx, LLM qua API kiểu OpenAI) xử lý AI và lập chỉ mục tri thức; ai-service (FastAPI) phục vụ hỏi đáp với PostgreSQL pgvector; bot-worker (Playwright, Chromium, Xvfb, PulseAudio) ghi âm Google Meet; integration-service (NestJS) đồng bộ Trello, Telegram; giao tiếp bất đồng bộ qua RabbitMQ với mẫu outbox và chống xử lý lặp; lưu âm thanh trên MinIO; giao diện Next.js; tiện ích Chrome Manifest V3. Toàn bộ backend đóng gói bằng Docker Compose (12 dịch vụ).

#### 4. Yêu cầu và cài đặt

Máy chủ Linux có Docker; tối thiểu 4 nhân CPU, 8 GB RAM (khuyến nghị 16 GB), khoảng 5 GB đĩa cho mô hình; không bắt buộc GPU. Cần khoá API Serverless Inference của FPT AI Factory (đặt trong tệp `.env`, biến `FPT_AI_API_KEY`, cùng khoá nội bộ `AI_INTERNAL_TOKEN` cho hỏi đáp) và một tài khoản Google riêng cho bot; tuỳ chọn khoá Trello và token bot Telegram (thiếu thì bỏ qua đồng bộ).

1. `docker compose up -d --build` để chạy backend; lần đầu tự tải mô hình Whisper và mô hình giọng nói.
2. Đăng nhập tài khoản Google cho bot một lần qua trình duyệt từ xa (noVNC) theo hướng dẫn trong mã nguồn.
3. Chạy giao diện web: `npm install && npm run dev` trong thư mục giao diện, mở `http://localhost:3001`.
4. Nạp tiện ích Chrome từ thư mục `extension` (chế độ nhà phát triển) nếu dùng đường đọc phụ đề.

#### 5. Kết quả đánh giá chính

Trên bộ thực nghiệm cuộc họp 4 người dựng bằng giọng tổng hợp: tách đúng 4/4 người nói, độ đúng theo thời gian 99,5% (điều kiện sạch); tỷ lệ lỗi từ của Whisper small khoảng 22% (sạch) đến 37% (nhiễu mạnh); LLM được chọn đạt 15/15 điểm trích xuất trên transcript chuẩn ở cả ba lần chạy; xử lý một cuộc họp 2,5 phút mất khoảng 2,5 phút trên CPU laptop, chi phí LLM khoảng 0,005 USD mỗi cuộc họp; thẻ Trello được tạo sau 3,4 giây kể từ khi duyệt, kèm tin báo qua Telegram; hỏi đáp tri thức đạt 27/27 câu trên ba cuộc họp (kể cả 5 phép thử rò rỉ quyền), trung bình dưới 2 giây mỗi câu.

#### 6. Giới hạn hiện tại

Chưa đồng bộ Jira; kết nối Trello, Telegram cấu hình qua biến môi trường, đồng bộ một chiều, chưa có màn hình kết nối theo workspace; chức năng đánh dấu nói chồng chưa tin cậy; chỉ hỗ trợ bot cho Google Meet.
