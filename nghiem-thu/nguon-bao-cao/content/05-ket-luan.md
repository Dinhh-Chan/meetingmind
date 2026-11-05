#! KẾT LUẬN VÀ KIẾN NGHỊ

## Kết luận

Đề tài đặt mục tiêu xây dựng một hệ thống trợ lý cuộc họp ứng dụng nhận dạng tiếng nói và mô hình ngôn ngữ lớn, tự động hoá việc ghi biên bản, trích xuất công việc kèm người thực hiện và thời hạn, và đưa công việc vào quy trình quản lý của nhóm. Sau sáu tháng thực hiện, nhóm nghiên cứu đã hoàn thành sản phẩm MeetingMind ở dạng ứng dụng web chạy được trọn luồng từ âm thanh cuộc họp đến công việc đã được duyệt và được đẩy sang Trello, báo qua Telegram, cùng bộ số liệu thực nghiệm đánh giá từng thành phần AI. Các kết quả chính có thể tóm lược như sau.

Thứ nhất, về nghiên cứu tổng quan và thiết kế, đề tài đã hệ thống hoá các hướng tiếp cận nhận dạng tiếng nói, tách người nói và trích xuất thông tin bằng LLM, từ đó chọn kiến trúc nhiều đường thu nhận đổ về một luồng xử lý chung. Thiết kế hướng sự kiện với hàng đợi thông điệp, mẫu outbox và cơ chế chống xử lý lặp cho phép thay bộ phiên âm và bộ phân tích giả lập bằng mô hình thật ở cuối đề tài mà gần như không phải sửa luồng điều phối. Cơ sở dữ liệu lưu transcript và biên bản theo phiên bản, nên công việc đã duyệt luôn truy được về đúng câu nói gốc. Phân quyền theo vai trò kết hợp phạm vi tài nguyên (workspace, dự án, cuộc họp) với 54 quyền đã được hiện thực ở dịch vụ lõi.

Thứ hai, về thu nhận và xử lý âm thanh, hệ thống có ba đường đưa nội dung cuộc họp vào: tải tệp ghi âm, bot tự tham gia Google Meet để ghi âm, và tiện ích Chrome đọc phụ đề Google Meet mà không cần bot. Module phiên âm dùng Whisper (bản faster-whisper chạy CPU) với cơ chế nhận diện ngôn ngữ hai lượt cho hội thoại xen Việt – Anh và các biện pháp hạn chế ảo giác ở đoạn lặng hoặc nhiễu. Module tách người nói dựa trên vector đặc trưng giọng ERes2Net và gom cụm phân cấp. Trên bộ dữ liệu thực nghiệm, hệ thống phân biệt đúng 4/4 người nói với độ đúng theo thời gian 99,5% ở điều kiện sạch, giữ trên 84% ở các điều kiện nhiễu, và không sinh câu bịa trong đoạn chỉ có nhiễu nền.

Thứ ba, về phân tích biên bản, đề tài đã xây dựng bộ phân tích dùng LLM qua dịch vụ suy luận FPT AI Factory, có mô hình dự phòng, chuẩn hoá đầu ra và đối chiếu bằng chứng với transcript. Mô hình được chọn bằng thực nghiệm có kiểm soát trên chín mô hình: DeepSeek-V4.1-Flash đạt trọn 15/15 điểm ở cả ba lần chạy trên bài kiểm tra có các tình huống bẫy (đề xuất khác quyết định, đính chính thời hạn, đổi người thực hiện, chuyện ngoài lề), với chi phí khoảng 0,005 USD mỗi cuộc họp. Kết quả AI không được ghi thẳng thành dữ liệu chính thức mà đi vào hàng đợi duyệt; chỉ khi trưởng nhóm duyệt, công việc và quyết định mới được tạo. Công việc đã duyệt được dịch vụ tích hợp tự động tạo thành thẻ Trello kèm người thực hiện, hạn và câu trích nguồn, đồng thời báo qua bot Telegram; cơ chế chống tạo trùng ba lớp bảo đảm thử lại không sinh thẻ thứ hai.

Thứ tư, ngoài các nội dung của đề cương, nhóm đã bổ sung chức năng hỏi đáp tri thức cuộc họp theo hướng sinh văn bản tăng cường truy xuất. Transcript, biên bản, quyết định, công việc và tài liệu đính kèm được chia đoạn, nhúng vector bằng mô hình tiếng Việt và lưu trong PostgreSQL với pgvector; câu hỏi được tìm kiếm, xếp hạng lại rồi trả lời bằng LLM chỉ từ các nguồn đánh số, mỗi ý kèm trích dẫn dẫn tới đúng cuộc họp và thời điểm. Quyền được lọc trước khi truy xuất ở hai lớp — Core tính tập cuộc họp người hỏi được xem bằng cùng luật với danh sách cuộc họp, câu SQL chỉ tìm trong tập đó — và Core kiểm tra lại từng trích dẫn trước khi trả về. Trên bộ chấm 10 câu hỏi, hệ thống đạt 10/10; trên bộ chấm mở rộng 27 câu trải trên ba cuộc họp, hai dự án và hai người dùng có quyền khác nhau, hệ thống đạt 27/27, trong đó cả 5 phép thử rò rỉ đều không lộ chi tiết nào của cuộc họp ngoài quyền; mỗi câu mất trung bình dưới 2 giây. Lịch sử hội thoại được lưu phía máy chủ theo từng người dùng, tài liệu quét được nhận dạng ký tự quang học ngay tại máy chủ.

Thứ năm, về sản phẩm, hệ thống được đóng gói bằng Docker Compose gồm 12 dịch vụ, có giao diện web Next.js với bảng điều khiển, danh sách và chi tiết cuộc họp, transcript theo người nói, biên bản, hàng đợi duyệt, bảng công việc và trang Tri thức để hỏi đáp. Các kiểm thử đơn vị (81 ca ở dịch vụ AI, 3 ca ở bot, 7 ca ở tiện ích, 20 ca ở dịch vụ tích hợp) và các kịch bản kiểm thử đầu-cuối trên môi trường Docker đều chạy thành công, trong đó luồng đồng bộ tạo được thẻ Trello và tin Telegram thật sau 3,4 giây kể từ khi duyệt.

Đối chiếu với đề cương, cả năm nội dung đều đạt yêu cầu. Ở nội dung 4, ngoài tác tử AI tạo biên bản và trích xuất công việc, yêu cầu đồng bộ công việc lên "Jira/Trello" được đáp ứng bằng Trello và yêu cầu cảnh báo công việc mới qua Telegram đã được hiện thực, cả hai đều đã kiểm thử với tài khoản thật; đồng bộ Jira chưa được làm và phần tích hợp mới ở mức MVP, như nêu ở mục Hạn chế. Chức năng hỏi đáp tri thức có trích nguồn là phần bổ sung ngoài đề cương.

## Hạn chế

Bên cạnh các kết quả trên, đề tài còn những hạn chế cần nêu rõ:

- Độ chính xác nhận dạng tiếng nói với mô hình Whisper small trên CPU còn hạn chế: tỷ lệ lỗi từ khoảng 22% ở điều kiện sạch và tăng lên khoảng 37% khi nhiễu mạnh, chủ yếu do thuật ngữ tiếng Anh (tên công nghệ, sản phẩm) và một số lỗi dấu thanh. Lỗi này lan sang bước trích xuất: điểm trích xuất trên transcript do máy nhận dạng thấp hơn đáng kể so với trên transcript chuẩn.
- Cơ chế đánh dấu nói chồng dùng ngưỡng tương đối nên báo nhầm nhiều đoạn trên bản ghi không có nói chồng và không bắt được các đoạn nói chồng ngắn trong bộ thử; chức năng này đã được tắt mặc định và cần thiết kế lại trước khi dùng thực tế.
- Bộ dữ liệu thực nghiệm được dựng bằng giọng tổng hợp (TTS) từ một kịch bản cuộc họp, nên chưa phản ánh đầy đủ giọng nói tự nhiên, giọng địa phương, tiếng vọng phòng họp và cách nói ngập ngừng. Hiệu quả tiết kiệm thời gian mới được ước tính, chưa đo trên người dùng thật.
- Phần tích hợp mới ở mức MVP: mỗi nền tảng một kết nối cấu hình qua biến môi trường, chưa có màn hình kết nối OAuth và chọn bảng theo từng workspace; đồng bộ một chiều (tạo thẻ, chưa cập nhật trạng thái hai chiều); tin Telegram có thể bị gửi trùng khi mất phản hồi; chưa có đồng bộ Jira.
- Chưa có bộ phát hiện rủi ro phía máy chủ; dữ liệu hội thoại chưa được mã hoá khi lưu trữ mà mới được bảo vệ bằng phân quyền.
- Ở chức năng hỏi đáp, bộ lọc quyền dựa trên danh sách cuộc họp do Core tính ở mỗi câu hỏi; chỉ mục chưa lưu thuộc tính quyền như thiết kế ban đầu. Nhận dạng ký tự quang học cho tài liệu quét chưa khử nghiêng và chưa thử với chữ viết tay, mỗi trang quét mất khoảng 2–3 giây. Bộ chấm hỏi đáp dùng cuộc họp dựng theo kịch bản và chấm theo từ khoá, chưa phải kho cuộc họp thật quy mô lớn.
- Một số điểm thiết kế chưa hiện thực đầy đủ: ghi outbox cùng giao dịch với dữ liệu nghiệp vụ, đường đi qua API Gateway, cơ chế tự thử lại job lỗi và hàng đợi thư chết (dead-letter queue).

## Hướng phát triển

Từ các hạn chế trên, nhóm đề xuất các hướng phát triển theo thứ tự ưu tiên:

1. Hoàn thiện tích hợp: màn hình kết nối OAuth 2.0 và chọn bảng theo từng workspace thay cho cấu hình bằng biến môi trường; đồng bộ hai chiều trạng thái công việc qua webhook; bổ sung Jira theo cùng cơ chế job và chống tạo trùng đã có; nhắc việc sắp đến hạn qua Telegram.
2. Nâng chất lượng nhận dạng: chạy mô hình Whisper lớn hơn trên GPU, thử các bản Whisper tinh chỉnh cho tiếng Việt, và đưa từ điển thuật ngữ riêng của từng dự án vào bước giải mã.
3. Thay cơ chế đánh dấu nói chồng bằng mô hình phát hiện nói chồng chuyên dụng, và cho người dùng gán tên người nói một lần để dùng lại ở các cuộc họp sau (nhận dạng người nói theo giọng đã đăng ký).
4. Đánh giá hỏi đáp tri thức trên kho cuộc họp thật quy mô lớn với người chấm, bổ sung chấm độ đúng của từng trích dẫn, và cải thiện nhận dạng tài liệu quét (khử nghiêng, chữ viết tay).
5. Đánh giá trên cuộc họp thật của các nhóm sinh viên và doanh nghiệp nhỏ, đo thời gian người dùng cần để rà soát biên bản do AI đề xuất so với tự viết, làm cơ sở định lượng hiệu quả tiết kiệm thời gian.

## Kiến nghị

Kết quả đề tài có thể áp dụng trước hết cho các nhóm dự án phần mềm, nhóm nghiên cứu và câu lạc bộ sinh viên thường xuyên họp trực tuyến trên Google Meet, nơi việc ghi biên bản và giao việc sau họp đang làm thủ công. Với các tổ chức có yêu cầu bảo mật cao, kiến trúc của hệ thống cho phép chạy toàn bộ phần xử lý âm thanh trên máy chủ nội bộ và chỉ gọi LLM qua nhà cung cấp trong nước, hoặc thay bằng mô hình tự triển khai.

Nhóm nghiên cứu kính đề nghị Viện Khoa học Kỹ thuật Bưu điện xem xét nghiệm thu đề tài, và tạo điều kiện để nhóm tiếp tục phát triển các hướng nêu trên, đặc biệt là thử nghiệm hệ thống trên các cuộc họp thực tế trong Học viện. Nhóm xin chân thành cảm ơn TS. Lê Văn Hoàng đã tận tình hướng dẫn trong suốt quá trình thực hiện đề tài.
