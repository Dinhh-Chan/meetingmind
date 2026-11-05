# Giới thiệu nội dung

## Nhiệm vụ theo đề cương

Nội dung 1 là bước khởi đầu của đề tài "Thiết kế và triển khai hệ thống Meet-Assistant: Tự động hóa take-note và đồng bộ hóa quản lý công việc", thực hiện trong tháng 05/2026. Theo đề cương đã được phê duyệt, nhiệm vụ của bước này là nghiên cứu tổng quan các công nghệ nhận dạng tiếng nói (Speech-to-Text, STT) như Whisper và wav2vec 2.0, các mô hình ngôn ngữ lớn (Large Language Model, LLM) như GPT và Gemini, cùng các giao thức tích hợp ứng dụng (Webhook, OAuth 2.0). Kết quả cần đạt gồm bản tổng quan tài liệu, xác định mô hình AI chủ đạo cho hệ thống và xác định các nền tảng quản lý công việc mục tiêu (Jira, Trello).

Bước tổng quan có vai trò định hướng cho toàn bộ các bước sau. Lựa chọn mô hình STT quyết định chất lượng transcript, mà transcript lại là đầu vào duy nhất của bước tóm tắt và trích xuất công việc. Lựa chọn kiến trúc giao tiếp giữa các thành phần quyết định khả năng thay thế mô hình AI về sau mà không phải viết lại luồng nghiệp vụ. Vì vậy, ngoài các công nghệ AI, nhóm nghiên cứu khảo sát thêm kiến trúc microservices hướng sự kiện, các cách thu nhận nội dung họp trực tuyến và các mô hình kiểm soát truy cập.

## Phương pháp thực hiện

Nhóm sử dụng phương pháp nghiên cứu tài liệu: đọc các bài báo gốc về Whisper, wav2vec 2.0, x-vector, ERes2Net, Transformer và các báo cáo kỹ thuật của các họ LLM; đọc tài liệu chính thức của RabbitMQ, Chrome Extensions, Playwright, Jira, Trello và Telegram; khảo sát các sản phẩm trợ lý cuộc họp đang có trên thị trường (Otter.ai, Fireflies.ai, Tactiq, Microsoft Teams Premium) theo hai tiêu chí là cách thu nhận nội dung cuộc họp và mức độ phù hợp với nhóm nhỏ tại Việt Nam. Bên cạnh đó, nhóm chạy thử nhanh các thư viện ứng viên trên máy cá nhân để kiểm tra khả năng chạy trên CPU, vì đây là điều kiện phần cứng thực tế của nhóm.

Phần còn lại của báo cáo này trình bày kết quả tổng quan (chương tiếp theo) và các lựa chọn công nghệ rút ra từ tổng quan (chương cuối).

::include 01-co-so-ly-thuyet.md

# Kết quả nội dung và đánh giá

## Các lựa chọn công nghệ rút ra từ tổng quan

Từ kết quả tổng quan, nhóm xác định công nghệ chủ đạo cho từng thành phần của hệ thống như trong [[tb-nd1-choice]]. Nguyên tắc chung là ưu tiên mô hình mã nguồn mở chạy được trên CPU cho các bước xử lý âm thanh (để dữ liệu ghi âm không phải rời khỏi máy chủ của tổ chức), và đặt bộ phân tích LLM sau một giao diện chung để có thể đổi nhà cung cấp mà không ảnh hưởng luồng nghiệp vụ.

::table tb-nd1-choice | Công nghệ chủ đạo được xác định sau bước tổng quan
| Thành phần | Công nghệ lựa chọn | Lý do chính |
|---|---|---|
| Nhận dạng tiếng nói | Whisper (bản faster-whisper, model small, int8 trên CPU) | Đa ngôn ngữ, tự nhận diện ngôn ngữ, chạy được trên CPU; có thể nâng lên medium/large khi có GPU |
| Tách người nói | Vector đặc trưng giọng ERes2Net (sherpa-onnx) + gom cụm phân cấp | Không cần token Hugging Face, chạy ONNX trên CPU, không phụ thuộc số người nói cho trước |
| Tóm tắt, trích xuất công việc | LLM qua API kiểu OpenAI; giai đoạn đầu dùng bộ giả lập, chốt mô hình bằng thực nghiệm ở bước kiểm thử | Tách biệt luồng nghiệp vụ với nhà cung cấp; chọn mô hình dựa trên số liệu thay vì cảm tính |
| Thu nhận nội dung | Ba đường: tải file ghi âm, bot vào Google Meet, extension đọc phụ đề | Mỗi đường bù cho hạn chế của đường kia (xem phần tổng quan) |
| Giao tiếp giữa thành phần | RabbitMQ + mẫu transactional outbox + idempotency | Xử lý AI kéo dài vài phút, cần bất đồng bộ và chống xử lý lặp |
| Nền tảng quản lý công việc mục tiêu | Jira Cloud và Trello (REST API, OAuth 2.0/API key, Webhook) | Phổ biến trong các nhóm phát triển phần mềm tại Việt Nam |
| Kênh cảnh báo | Telegram Bot API | Đơn giản, miễn phí, phổ biến |
| Kiểm soát truy cập | Vai trò kết hợp phạm vi tài nguyên (workspace, dự án, cuộc họp) | RBAC thuần không đủ để tách quyền theo dự án và cuộc họp |

Đề cương ban đầu dự kiến dùng các LLM như GPT hoặc Gemini. Khi triển khai thực tế, nhóm chọn dịch vụ suy luận của FPT AI Factory (các mô hình do FPT tự vận hành) vì hai lý do: dữ liệu cuộc họp không phải gửi ra máy chủ nước ngoài, và chi phí cho mỗi cuộc họp rất thấp. Mô hình cụ thể (DeepSeek-V4.1-Flash làm mô hình chính, GLM-5.2 làm dự phòng) được chốt bằng thực nghiệm so sánh chín mô hình ở bước kiểm thử, trình bày trong báo cáo Nội dung 5.

## Đối chiếu với kết quả cần đạt

::table tb-nd1-result | Đối chiếu kết quả Nội dung 1 với đề cương
| Kết quả cần đạt theo đề cương | Kết quả thực hiện | Đánh giá |
|---|---|---|
| Bản tổng quan tài liệu | Tổng quan về STT, tách người nói, LLM, kiến trúc hướng sự kiện, thu nhận họp trực tuyến, tích hợp và kiểm soát truy cập (chương 2 của báo cáo này) | Đạt |
| Xác định mô hình AI chủ đạo | Whisper (faster-whisper) cho STT; ERes2Net + gom cụm cho tách người nói; LLM qua giao diện chung, mô hình cụ thể chốt bằng thực nghiệm | Đạt |
| Xác định nền tảng quản lý mục tiêu (Jira, Trello) | Đã khảo sát API, cơ chế xác thực và Webhook của Jira, Trello, Telegram; chọn làm đích đồng bộ | Đạt |

Bước tổng quan đã hoàn thành đúng hạn và đủ các kết quả cần đạt. Các lựa chọn công nghệ ở bước này được giữ nguyên trong suốt quá trình xây dựng, trừ phần LLM được cụ thể hoá thêm bằng thực nghiệm ở cuối đề tài. Kết quả khảo sát API của Trello và Telegram (khoá API kèm token người dùng, danh sách và thẻ của Trello; phương thức `sendMessage`, `getUpdates` của Telegram) được dùng trực tiếp khi hiện thực mô-đun đồng bộ ở cuối đề tài (xem báo cáo Nội dung 4); với Jira, khảo sát mới dừng ở mức lý thuyết và thiết kế.
