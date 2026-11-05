# Giới thiệu nội dung

## Nhiệm vụ theo đề cương

Nội dung 4 được thực hiện trong tháng 09/2026. Theo đề cương, nhiệm vụ của bước này là xây dựng AI Agent tóm tắt và đồng bộ: triển khai LLM để trích xuất các đầu việc (action items), xây dựng module kết nối và tự động đẩy công việc sang các công cụ quản lý dự án. Kết quả cần đạt gồm Agent tự động tạo biên bản họp, đồng bộ thành công công việc lên Jira/Trello và hệ thống cảnh báo công việc mới qua Telegram.

Điểm mấu chốt về thiết kế của nội dung này là AI chỉ đề xuất, con người quyết định. Biên bản và công việc do LLM sinh ra có thể sai (bịa người thực hiện, bịa thời hạn, nhầm đề xuất thành quyết định), nên kết quả của AI phải đi qua hàng đợi duyệt; chỉ công việc đã được trưởng nhóm duyệt mới trở thành công việc chính thức và mới được phép đồng bộ ra công cụ bên ngoài.

## Phương pháp thực hiện

Bộ phân tích được thiết kế sau một giao diện chung để luồng nghiệp vụ không phụ thuộc nhà cung cấp LLM. Trong tháng 09/2026, nhóm hoàn thành toàn bộ luồng từ transcript đến biên bản nháp, hàng đợi duyệt và công việc chính thức với một bộ phân tích giả lập có đầu ra cố định, được chọn để kiểm tra các quy tắc nghiệp vụ. LLM thật (qua dịch vụ FPT AI Factory) được gắn vào sau, và mô hình được chọn bằng thực nghiệm so sánh có đáp án. Phần đồng bộ được thiết kế dữ liệu và luồng sự kiện trước, sau đó hiện thực trong integration-service ở giai đoạn hoàn thiện (đầu tháng 11/2026) cho Trello và Telegram, theo đúng hai nguyên tắc đã đặt: chỉ đồng bộ công việc đã duyệt và thử lại không tạo bản trùng. Mô-đun được kiểm thử bằng kiểm thử đơn vị với các lời gọi API giả lập, rồi chạy đầu-cuối với tài khoản Trello và bot Telegram thật; đồng bộ Jira giữ ở mức thiết kế. Cũng trong đầu tháng 11/2026, nhóm bổ sung cho Agent chức năng hỏi đáp tri thức cuộc họp theo hướng sinh văn bản tăng cường truy xuất, dùng lại hạ tầng FPT AI Factory và các quy tắc chống bịa của bộ phân tích; chức năng này nằm ngoài kết quả cần đạt của đề cương nên được trình bày như phần bổ sung, gồm mô-đun hỏi đáp ở phần xây dựng và mục đánh giá hỏi đáp ở phần thực nghiệm.

::include 02-phan-tich-thiet-ke.md 9,11

::include 03-xay-dung.md 6,7,8,9,10

::include 04-thuc-nghiem.md 6,7,9

# Kết quả nội dung và đánh giá

## Đối chiếu với kết quả cần đạt

::table tb-nd4-result | Đối chiếu kết quả Nội dung 4 với đề cương
| Kết quả cần đạt theo đề cương | Kết quả thực hiện | Đánh giá |
|---|---|---|
| Agent tự động tạo biên bản họp | Bộ phân tích LLM (DeepSeek-V4.1-Flash, dự phòng GLM-5.2) tạo tóm tắt, quyết định, vấn đề còn mở, công việc kèm người thực hiện, thời hạn, câu trích dẫn; Core tạo biên bản nháp theo phiên bản và hàng đợi duyệt | Đạt |
| Trích xuất action items | 15/15 điểm trên transcript chuẩn ở cả 3 lần chạy; 8–15 điểm trên transcript do máy nhận dạng tuỳ điều kiện âm thanh | Đạt |
| Đồng bộ thành công công việc lên Jira/Trello | integration-service tạo thẻ Trello cho công việc đã duyệt (người thực hiện, hạn, ưu tiên, câu trích nguồn), chống tạo trùng ba lớp, trả kết quả về Core và giao diện; với tài khoản Trello thật, thẻ được tạo sau 3,4 s kể từ khi duyệt. Jira chưa hiện thực | Đạt (qua Trello; Jira chưa làm) |
| Cảnh báo công việc mới qua Telegram | Bot Telegram riêng của MeetingMind gửi tin "Công việc mới từ cuộc họp" kèm đường dẫn thẻ Trello; đã chạy với bot thật | Đạt |
| (Bổ sung) Con người duyệt trước khi giao việc | Duyệt, sửa, từ chối đề xuất trên giao diện; chỉ mục đã duyệt mới thành công việc, quyết định chính thức | Đạt |
| (Bổ sung) Hỏi đáp tri thức có trích nguồn | Lập chỉ mục transcript, biên bản, quyết định, công việc, tài liệu (Vietnamese_Embedding, pgvector HNSW); xếp hạng lại bằng bge-reranker-v2-m3; GLM-5.2 trả lời chỉ từ nguồn, mỗi ý có trích dẫn, thiếu nguồn trả "chưa đủ thông tin"; lọc quyền ở Core và trong câu SQL, kiểm tra lại trích dẫn; lưu hội thoại phía máy chủ; 10/10 và 27/27 câu đạt (5 phép thử rò rỉ quyền đều đạt), trung bình dưới 2 s mỗi câu | Đạt |

## Tồn tại và hướng hoàn thiện

Nội dung 4 đạt các kết quả cần đạt của đề cương. Phần AI Agent đạt và vượt yêu cầu về độ tin cậy nhờ cơ chế duyệt và đối chiếu bằng chứng. Phần đồng bộ đáp ứng yêu cầu "Jira/Trello" bằng Trello, kèm cảnh báo công việc mới qua Telegram, và đã được kiểm chứng với tài khoản thật; thiết kế chống tạo trùng được áp dụng đúng như dự kiến, kể cả tình huống lời gọi tạo thẻ thành công nhưng mất phản hồi.

Tuy vậy, phần đồng bộ mới ở mức sản phẩm khả dụng tối thiểu. Mỗi nền tảng chỉ có một kết nối cấu hình qua biến môi trường, chưa có màn hình kết nối OAuth và chọn bảng theo từng workspace; đồng bộ một chiều, chưa cập nhật trạng thái hai chiều; chưa có hàng đợi thư chết cho các lần đồng bộ lỗi; tin Telegram có thể bị gửi trùng nếu mất phản hồi vì Bot API không cho tra cứu tin đã gửi. Jira chưa được hiện thực do nhóm chỉ có hai thành viên và ưu tiên hoàn thiện nền tảng xử lý cùng chất lượng mô hình AI trước. Vì integration-service đã có sẵn cơ chế job theo khoá chống lặp, bảng liên kết ngoài và sự kiện kết quả, bổ sung Jira chủ yếu là viết thêm một client cho REST API của Jira. Hướng hoàn thiện tiếp theo là màn hình kết nối theo workspace, đồng bộ hai chiều qua webhook và tích hợp Jira.

Phần hỏi đáp tri thức bổ sung cho Agent khả năng tra cứu lại nội dung các cuộc họp đã qua, với cùng nguyên tắc chống bịa: chỉ trả lời từ nguồn, mỗi ý có trích dẫn kiểm chứng được, thiếu nguồn thì nói rõ, và người hỏi chỉ được tìm trong những cuộc họp mình có quyền xem. Lịch sử hội thoại được lưu phía máy chủ theo từng người dùng, tài liệu quét được nhận dạng ký tự quang học tại máy chủ, xoá cuộc họp thì xoá chỉ mục. Bộ chấm mở rộng 27 câu trên ba cuộc họp, hai người dùng có quyền khác nhau đạt 27/27 và không rò rỉ; bước tiếp theo là đánh giá trên kho cuộc họp thật quy mô lớn.
