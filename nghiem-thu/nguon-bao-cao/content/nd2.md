# Giới thiệu nội dung

## Nhiệm vụ theo đề cương

Nội dung 2 được thực hiện trong tháng 06/2026, tiếp nối kết quả tổng quan của Nội dung 1. Theo đề cương, nhiệm vụ của bước này là đặc tả yêu cầu hệ thống, thiết kế kiến trúc microservices xử lý âm thanh, thiết kế schema cơ sở dữ liệu và luồng xử lý prompt. Kết quả cần đạt gồm tài liệu đặc tả yêu cầu (Software Requirements Specification, SRS), sơ đồ kiến trúc hệ thống, thiết kế cơ sở dữ liệu và luồng dữ liệu từ âm thanh (Audio) đến công việc (Task).

Bài toán thiết kế của MeetingMind có ba điểm khó. Thứ nhất, một cuộc họp có thể đi vào hệ thống bằng nhiều đường khác nhau (tải file, bot, extension) nhưng phần xử lý phía sau phải dùng chung. Thứ hai, đầu ra của AI không đáng tin tuyệt đối nên không được ghi thẳng thành dữ liệu chính thức, mà phải qua bước con người duyệt. Thứ ba, transcript và biên bản có thể bị sửa nhiều lần, trong khi công việc đã giao phải luôn truy được về đúng câu nói gốc tại thời điểm duyệt.

## Phương pháp thực hiện

Nhóm phân tích yêu cầu từ quy trình họp thực tế của các nhóm phát triển phần mềm (trước, trong và sau cuộc họp), xác định tác nhân và ca sử dụng, sau đó thiết kế theo hướng sự kiện: mỗi bước xử lý dài (phiên âm, phân tích) là một job bất đồng bộ, giao tiếp qua hàng đợi thông điệp. Cơ sở dữ liệu được thiết kế theo nguyên tắc mỗi bảng có đúng một dịch vụ sở hữu và mọi dữ liệu do AI sinh ra đều được lưu theo phiên bản. Các tài liệu thiết kế gốc (tổng quan dự án, kiến trúc, thiết kế cơ sở dữ liệu, hợp đồng sự kiện) được lưu cùng mã nguồn để thiết kế và cài đặt luôn đi cùng nhau.

::include 02-phan-tich-thiet-ke.md

# Kết quả nội dung và đánh giá

## Đối chiếu với kết quả cần đạt

::table tb-nd2-result | Đối chiếu kết quả Nội dung 2 với đề cương
| Kết quả cần đạt theo đề cương | Kết quả thực hiện | Đánh giá |
|---|---|---|
| Tài liệu đặc tả yêu cầu (SRS) | Tài liệu tổng quan dự án 15 mục: tác nhân, yêu cầu chức năng và phi chức năng, quy trình họp mẫu, màn hình, tiêu chí nghiệm thu, quy tắc chống AI bịa việc | Đạt |
| Sơ đồ kiến trúc hệ thống | Kiến trúc 5 dịch vụ backend, frontend và extension; giao tiếp đồng bộ qua HTTP và bất đồng bộ qua RabbitMQ; nguyên tắc outbox, idempotency, AI chỉ đề xuất | Đạt |
| Thiết kế cơ sở dữ liệu | 43 bảng trong 3 schema (core, integration, ai) với 3 tài khoản riêng; transcript và biên bản lưu theo phiên bản | Đạt (schema core và integration đã hiện thực; ai mới ở mức thiết kế) |
| Luồng dữ liệu từ Audio đến Task | Luồng 10 bước từ thu nhận đến công việc chính thức; hợp đồng sự kiện dùng chung giữa TypeScript và Python | Đạt |
| Thiết kế luồng xử lý prompt | Quy tắc chống bịa, cấu trúc JSON đầu ra, đối chiếu bằng chứng, con người duyệt | Đạt |

Thiết kế ở bước này là nền tảng ổn định cho các bước sau: khi thay bộ phiên âm và bộ phân tích giả lập bằng Whisper và LLM thật ở cuối đề tài, luồng điều phối trong core-service gần như không phải sửa, đúng với mục tiêu tách biệt đã đặt ra. Thiết kế module đồng bộ cũng được dùng gần như nguyên vẹn khi hiện thực đồng bộ Trello và Telegram (xem báo cáo Nội dung 4), chỉ điều chỉnh để thông điệp mang sẵn ảnh chụp công việc thay vì gọi ngược API của Core. Một số điểm thiết kế chưa được hiện thực đầy đủ và được ghi nhận trung thực trong chương thiết kế: ghi outbox cùng giao dịch với dữ liệu nghiệp vụ, đường đi qua API Gateway, schema ai, phần Jira và kết nối OAuth theo workspace của module đồng bộ.
