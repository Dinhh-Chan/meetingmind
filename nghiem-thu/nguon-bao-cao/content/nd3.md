# Giới thiệu nội dung

## Nhiệm vụ theo đề cương

Nội dung 3 được thực hiện trong tháng 07–08/2026. Theo đề cương, nhiệm vụ của bước này là xây dựng module lõi xử lý âm thanh và nhận dạng tiếng nói: triển khai dịch vụ thu âm, xử lý nhiễu và chuyển đổi hội thoại thành văn bản. Kết quả cần đạt gồm API hoàn chỉnh cho xử lý âm thanh (Audio Processing) và module nhận dạng tiếng nói (STT) hoạt động ổn định với độ chính xác cao trên tiếng Việt.

Trong quá trình thực hiện, phạm vi của nội dung này được mở rộng theo kết quả tổng quan: ngoài phiên âm, hệ thống cần biết *ai nói câu nào* (tách người nói) để giao việc đúng người, và cần nhiều đường đưa âm thanh vào hệ thống (tải tệp, bot tham gia Google Meet, tiện ích đọc phụ đề). Phần nền của dịch vụ lõi (điều phối job, hàng đợi thông điệp, lưu trữ âm thanh) được xây dựng trước trong tháng 07–08/2026; các mô hình nhận dạng và tách người nói thật được gắn vào thay cho bộ giả lập trong giai đoạn hoàn thiện, khi giao diện chung đã ổn định.

## Phương pháp thực hiện

Nhóm xây dựng theo nguyên tắc "thông luồng trước, thay mô hình sau": dựng toàn bộ đường đi của âm thanh với bộ phiên âm giả lập để kiểm chứng điều phối, sau đó thay bằng Whisper và mô hình giọng nói thật sau một giao diện chung, chọn bằng biến môi trường. Mỗi lựa chọn kỹ thuật (mô hình, tham số giải mã, ngưỡng gom cụm) được kiểm chứng bằng kiểm thử đơn vị và bằng thực nghiệm định lượng trên bộ dữ liệu dựng có đáp án, trình bày ở chương đánh giá của báo cáo này.

::include 03-xay-dung.md 1,2,3,4,5,11

::include 04-thuc-nghiem.md 2,3,4,5,8

# Kết quả nội dung và đánh giá

## Đối chiếu với kết quả cần đạt

::table tb-nd3-result | Đối chiếu kết quả Nội dung 3 với đề cương
| Kết quả cần đạt theo đề cương | Kết quả thực hiện | Đánh giá |
|---|---|---|
| Triển khai dịch vụ thu âm | Ba đường thu nhận: tải tệp lên MinIO (khử trùng lặp, URL ký), bot ghi âm Google Meet (Playwright, Xvfb, PulseAudio, MediaRecorder), tiện ích Chrome đọc phụ đề | Đạt (bot mới kiểm thử đến bước vào phòng chờ) |
| API hoàn chỉnh cho xử lý âm thanh | API tải tệp, khởi động phiên âm, mời/dừng bot, nhận phụ đề trực tiếp; điều phối qua RabbitMQ với outbox và chống xử lý lặp | Đạt |
| Xử lý nhiễu | Lọc khoảng lặng bằng VAD, chống câu bịa của Whisper; không sinh văn bản trong đoạn chỉ có nhiễu; WER tăng từ 21,7% (sạch) lên 26,9% (nhiễu 10 dB) | Đạt một phần (nhiễu rất mạnh 5 dB: WER 36,6%) |
| Module STT ổn định, chính xác cao trên tiếng Việt | Whisper small trên CPU: WER 21,7%, CER 15,8%; Whisper medium: WER 14,7%; nhận diện ngôn ngữ theo đoạn cho hội thoại xen Anh – Việt | Đạt ở mức dùng được, cần mô hình lớn hơn để đạt độ chính xác cao |
| (Mở rộng) Tách người nói | Tìm đúng 4/4 người, độ đúng 99,5% ở điều kiện sạch, 85–95% khi có nhiễu | Đạt; đánh dấu nói chồng chưa đạt |

## Tồn tại và hướng hoàn thiện

Kết quả nội dung 3 đáp ứng yêu cầu về dịch vụ thu âm và API xử lý âm thanh. Về độ chính xác, cấu hình mặc định (Whisper small chạy CPU) đủ để làm đầu vào cho bước trích xuất có con người rà soát, nhưng chưa đạt mức "chính xác cao" như kỳ vọng của đề cương, chủ yếu do thuật ngữ tiếng Anh và giới hạn phần cứng. Thực nghiệm đã chỉ ra hai hướng cải thiện có hiệu quả đo được: dùng mô hình medium (WER giảm khoảng một phần ba) khi có GPU, và cấu hình từ điển thuật ngữ theo dự án (số thuật ngữ nhận đúng tăng từ 2 lên 11/24). Chức năng đánh dấu nói chồng cần thiết kế lại bằng mô hình phát hiện nói chồng chuyên dụng; kịch bản ghi âm dài của bot sau khi được cho vào phòng cần được kiểm thử trọn vẹn với cuộc họp thật.
