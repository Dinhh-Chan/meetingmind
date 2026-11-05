# Giới thiệu nội dung

## Nhiệm vụ theo đề cương

Nội dung 5 được thực hiện trong tháng 10/2026 và hoàn thiện đầu tháng 11/2026. Theo đề cương, nhiệm vụ của bước này là hoàn thiện báo cáo và kiểm thử: đánh giá độ chính xác của AI, đo lường thời gian tiết kiệm được và viết báo cáo tổng hợp kết quả nghiên cứu. Kết quả cần đạt gồm bản báo cáo nghiên cứu khoa học đầy đủ nội dung, kết quả thực nghiệm và đánh giá hiệu năng hệ thống.

## Phương pháp thực hiện

Nhóm xây dựng một quy trình đánh giá có thể chạy lại: một kịch bản cuộc họp có đáp án được tổng hợp thành âm thanh nhiều giọng, tạo ra nhiều điều kiện nhiễu, sau đó chạy qua đúng mã nguồn của hệ thống trong container. Các tập lệnh đánh giá tự tính tỷ lệ lỗi từ, độ đúng người nói, điểm trích xuất biên bản và thời gian từng bước, lưu kết quả thô để kiểm tra. Song song, nhóm chạy các kịch bản kiểm thử chức năng đầu-cuối trên môi trường Docker Compose và bộ kiểm thử đơn vị của từng dịch vụ. Toàn bộ kết quả được tổng hợp vào quyển báo cáo tổng kết và các báo cáo nội dung.

::include 04-thuc-nghiem.md

::include 03-xay-dung.md 12

# Kết quả nội dung và đánh giá

## Đối chiếu với kết quả cần đạt

::table tb-nd5-result | Đối chiếu kết quả Nội dung 5 với đề cương
| Kết quả cần đạt theo đề cương | Kết quả thực hiện | Đánh giá |
|---|---|---|
| Đánh giá độ chính xác của AI | WER/CER của Whisper small, small + từ điển thuật ngữ, medium trên 6 điều kiện âm thanh; độ đúng tách người nói; so sánh 9 LLM; đánh giá đầu-cuối từ âm thanh đến công việc; chấm hỏi đáp tri thức (10/10 câu; bộ mở rộng 27/27 câu, không rò rỉ quyền) | Đạt |
| Đo lường thời gian tiết kiệm được | Đo thời gian xử lý thực tế từng bước (RTF 0,73 với mô hình mặc định); thời gian công sức con người tiết kiệm mới là ước tính có giả định (khoảng 30 phút mỗi cuộc họp 60 phút) | Đạt một phần |
| Kết quả thực nghiệm và đánh giá hiệu năng | Bảng số liệu và biểu đồ cho từng câu hỏi thực nghiệm; chi phí LLM khoảng 0,005 USD mỗi cuộc họp thử | Đạt |
| Báo cáo NCKH đầy đủ nội dung | Quyển báo cáo tổng kết, 5 báo cáo nội dung, thuyết minh sản phẩm, slide báo cáo | Đạt |

## Tồn tại và hướng hoàn thiện

Quy trình đánh giá đã được tự động hoá và có thể áp dụng lại khi có dữ liệu mới. Hạn chế chính là dữ liệu dựng bằng giọng tổng hợp và quy mô nhỏ, cùng với việc thời gian tiết kiệm mới được ước tính. Bước tiếp theo là thu thập ghi âm cuộc họp thật của các nhóm sinh viên (có sự đồng ý của người tham gia), gán nhãn thủ công, chạy lại toàn bộ quy trình đánh giá và đo thời gian rà soát biên bản trên người dùng thật.
