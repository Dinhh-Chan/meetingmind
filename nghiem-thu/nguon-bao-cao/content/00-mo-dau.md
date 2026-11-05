#! MỞ ĐẦU

## Tổng quan tình hình nghiên cứu

Cuộc họp là nơi một nhóm làm việc chia sẻ thông tin, ra quyết định và phân công công việc. Họp trực tuyến qua Google Meet, Microsoft Teams hay Zoom nay đã thành thói quen, nhưng khâu biến nội dung họp thành biên bản và thành công việc cụ thể vẫn chủ yếu làm bằng tay. Bài toán trợ lý cuộc họp (meeting assistant) hướng tới tự động hoá khâu này bằng cách kết hợp nhận dạng tiếng nói, tách người nói, xử lý ngôn ngữ tự nhiên và tích hợp hệ thống.

#### Ngoài nước

Các sản phẩm thương mại đã phát triển mạnh. Otter.ai [@otter] cung cấp phiên âm, tóm tắt và trợ lý tự tham gia cuộc họp; Fireflies.ai [@fireflies] đưa bot vào phòng để ghi âm, sinh bản ghi lời nói, tóm tắt và đẩy kết quả sang công cụ khác; Tactiq [@tactiq] dùng tiện ích trình duyệt đọc phụ đề của nền tảng họp nên không cần bot; Microsoft Teams Premium tích hợp tính năng tổng hợp cuộc họp bằng trí tuệ nhân tạo ngay trong Teams. Năng lực tách người nói và tóm tắt của các sản phẩm này đã dùng được trong thực tế, trước hết với tiếng Anh.

Về học thuật, ngữ liệu AMI [@carletta2005] với khoảng một trăm giờ họp có chú giải là nền chung cho nhiều bài toán về cuộc họp; QMSum [@zhong2021qmsum] cho thấy thông tin cần tóm tắt thường nằm rải rác trong bản ghi dài, phải định vị trước khi tóm tắt. Trong nhận dạng tiếng nói, wav2vec 2.0 [@baevski2020] khai thác học tự giám sát trên âm thanh không nhãn, còn Whisper [@radford2023] được huấn luyện trên khoảng 680 nghìn giờ dữ liệu đa ngôn ngữ và bền vững với nhiều miền dữ liệu. Tách người nói đã chuyển sang vector giọng học sâu như x-vector [@snyder2018] và các bộ công cụ nơ-ron như pyannote.audio [@bredin2020], dù nói chồng và thu âm xa micro vẫn là thách thức [@park2022]. Mô hình ngôn ngữ lớn (Large Language Model, LLM) học được từ vài ví dụ trong ngữ cảnh [@brown2020], cho phép trích xuất thông tin mà không cần tập huấn luyện riêng, nhưng có nguy cơ "ảo giác" (hallucination) — sinh nội dung không có trong nguồn [@ji2023].

Với nhóm nhỏ tại Việt Nam, các giải pháp nước ngoài có ba hạn chế: chi phí bản quyền theo người dùng hằng tháng cao; tiếng Việt, nhất là tiếng Việt xen thuật ngữ tiếng Anh, chưa phải trọng tâm; dữ liệu hội thoại được xử lý ở nước ngoài và luồng dữ liệu khó tuỳ biến theo hệ thống quản lý riêng của từng đơn vị.

#### Trong nước

FPT.AI và Viettel AI đã cung cấp dịch vụ chuyển giọng nói thành văn bản (Speech-to-Text, STT) cho tiếng Việt với chất lượng tốt. Tuy nhiên, các giải pháp này chủ yếu dừng ở bản gỡ băng (transcript) thô hoặc tóm tắt đơn giản; việc nối nội dung họp với hệ thống quản lý công việc còn rời rạc, nhiều đơn vị vẫn tạo đầu việc trên Jira hay Trello bằng tay sau khi họp. Về học thuật, nhận dạng tiếng Việt đã có các công trình nền như bộ ngữ liệu VIVOS và công thức Kaldi [@luong2016vivos], nhưng ngữ liệu cuộc họp tiếng Việt công khai — nhiều người nói, có nhiễu, có nói chồng, xen tiếng Anh — gần như chưa có. Gần đây, FPT AI Factory [@fpt-aifactory] cung cấp dịch vụ suy luận LLM phi máy chủ (serverless) với giao diện tương thích OpenAI, cho phép dùng LLM mạnh trong khi dữ liệu vẫn xử lý trên hạ tầng trong nước.

Như vậy, các thành phần công nghệ đã tương đối sẵn sàng, nhưng còn thiếu một hệ thống liền mạch, chi phí hợp lý, phù hợp tiếng Việt, đi từ âm thanh cuộc họp đến công việc có nguồn kiểm chứng và được con người xác nhận. Đây là khoảng trống đề tài hướng tới.

## Lý do chọn đề tài

Đề tài xuất phát từ những khó khăn cụ thể trong làm việc nhóm. Người tham gia vừa thảo luận vừa ghi chép nên dễ bỏ sót; sau họp, người quản lý dự án (Project Manager, PM) mất thời gian chuyển biên bản thành công việc, điền người thực hiện và thời hạn. Một ý kiến mới ở mức đề xuất ("hay là mình dùng X") dễ bị hiểu nhầm thành quyết định; thời hạn bị đính chính giữa chừng có thể bị ghi theo thông tin cũ; và khi cần đối chiếu, rất khó truy lại câu nói gốc đã sinh ra một đầu việc.

Đồng thời, công nghệ đã đủ chín để nhóm nhỏ tự xây dựng giải pháp. Whisper có mã nguồn và trọng số mở; bản hiện thực faster-whisper chạy được trên CPU với trọng số lượng tử hoá. Các LLM có trọng số mở được cung cấp qua dịch vụ suy luận trong nước, tính phí theo lượng dùng. Nhờ đó, hệ thống có thể triển khai với chi phí thấp, chủ động về dữ liệu và tuỳ biến theo quy trình của nhóm.

Đề tài cũng đặt ra các câu hỏi nghiên cứu: nhận dạng tiếng nói đa ngôn ngữ đạt chất lượng ra sao với tiếng Việt xen tiếng Anh, khi có nhiễu và nói chồng; làm thế nào để LLM phân biệt đề xuất với quyết định, lấy thông tin sau cùng khi có đính chính, không bịa người hay hạn, và kết quả đó được kiểm chứng ra sao; kiến trúc nào phù hợp cho các tác vụ trí tuệ nhân tạo chạy lâu, bất đồng bộ mà vẫn bảo đảm nhất quán dữ liệu và kiểm soát truy cập nhiều tầng. Vì những lý do trên, chúng tôi chọn đề tài "Thiết kế và triển khai hệ thống Meet-Assistant: Tự động hóa take-note và đồng bộ hóa quản lý công việc", với sản phẩm là hệ thống MeetingMind.

## Mục tiêu đề tài

**Mục tiêu tổng quát.** Xây dựng hệ thống trợ lý cuộc họp ứng dụng trí tuệ nhân tạo (STT và LLM) để tự động hoá ghi chép biên bản, trích xuất chính xác các nhiệm vụ và kết nối kết quả cuộc họp với quản lý công việc, nhằm nâng cao hiệu suất làm việc nhóm.

**Mục tiêu cụ thể:**

1. Xây dựng ứng dụng web quản lý workspace, dự án, cuộc họp và công việc, phân quyền theo vai trò kết hợp phạm vi tài nguyên.
2. Thu nhận nội dung họp qua ba đường — tải tệp ghi âm, bot ghi âm Google Meet, tiện ích Chrome đọc phụ đề — hội tụ về một luồng xử lý chung.
3. Nhận dạng tiếng nói tiếng Việt có xử lý câu xen tiếng Anh, kèm tách người nói, chạy được trên máy chủ chỉ có CPU.
4. Dùng LLM sinh biên bản nháp, trích xuất quyết định, vấn đề còn mở và đầu việc kèm bằng chứng; mọi đề xuất của AI phải được người quản lý duyệt trước khi thành công việc chính thức.
5. Xây dựng backend microservices hướng sự kiện; tự động đồng bộ công việc đã duyệt sang Trello và thông báo công việc mới qua Telegram, với kiến trúc sẵn sàng mở rộng sang Jira và cảnh báo rủi ro.
6. Đánh giá định lượng độ chính xác nhận dạng tiếng nói, chất lượng trích xuất của các LLM và thời gian xử lý.

Đồng bộ sang Trello và thông báo qua Telegram được hiện thực ở mức sản phẩm khả dụng tối thiểu (Minimum Viable Product, MVP): mỗi nền tảng một kết nối cấu hình qua biến môi trường, đồng bộ một chiều. Các nội dung còn lại trong đề cương — đồng bộ sang Jira và Confluence, phát hiện rủi ro tiến độ, đối soát cam kết với kết quả thực hiện và mã hoá dữ liệu hội thoại — được trình bày ở mức thiết kế và định hướng phát triển; mức độ hoàn thành được phân tích ở phần Kết luận và kiến nghị. Ngoài các mục tiêu trên, nhóm hiện thực bổ sung chức năng hỏi đáp tri thức cuộc họp theo hướng sinh văn bản tăng cường truy xuất (Retrieval-Augmented Generation, RAG): người dùng đặt câu hỏi bằng ngôn ngữ tự nhiên và nhận câu trả lời kèm trích dẫn tới transcript, biên bản, quyết định, công việc hoặc tài liệu của những cuộc họp mình được quyền xem.

## Phương pháp nghiên cứu

**Nghiên cứu tài liệu:** tổng hợp các công trình về nhận dạng tiếng nói, tách người nói, LLM và tóm tắt cuộc họp; tài liệu kỹ thuật của công cụ sử dụng và của các nền tảng dự kiến tích hợp; khảo sát sản phẩm trợ lý cuộc họp hiện có để xác định hướng tiếp cận.

**Phân tích, thiết kế hướng đối tượng và hướng sự kiện:** đặc tả yêu cầu bằng tác nhân và ca sử dụng, mô hình hoá dữ liệu bằng sơ đồ thực thể – quan hệ, phân rã hệ thống thành các service theo miền nghiệp vụ. Các luồng xử lý dài được mô tả bằng sơ đồ tuần tự sự kiện, hợp đồng sự kiện đặc tả bằng JSON Schema, tính nhất quán bảo đảm bằng các mẫu transactional outbox và bên nhận lũy đẳng (idempotent consumer).

**Thực nghiệm định lượng trên bộ dữ liệu dựng có kiểm soát:** do thiếu ngữ liệu họp tiếng Việt có chú giải, nhóm dựng bộ dữ liệu có đáp án từ một kịch bản họp nhóm phần mềm, tổng hợp giọng nói bằng dịch vụ chuyển văn bản thành giọng nói (Text-to-Speech, TTS) với nhiều giọng, rồi tạo các biến thể có nhiễu trắng ở nhiều mức tỷ số tín hiệu trên nhiễu (Signal-to-Noise Ratio, SNR), nhiễu nói chuyện nền và nói chồng. Cách làm này cho phép thay đổi từng yếu tố độc lập; các đại lượng đo gồm tỷ lệ lỗi từ, tỷ lệ lỗi ký tự, độ đúng gán người nói và thời gian xử lý. Vì giọng tổng hợp sạch hơn giọng thật, kết quả chủ yếu dùng để so sánh tương đối giữa các cấu hình.

**So sánh mô hình:** chấm nhiều LLM trên FPT AI Factory với cùng một bản ghi họp có đáp án chứa các tình huống khó (đề xuất khác quyết định, hạn bị đính chính, đổi người làm, chuyện ngoài lề, câu tiếng Anh, người nói chỉ có nhãn tự động), so sánh độ đúng, độ ổn định qua nhiều lần chạy và thời gian phản hồi để chọn mô hình chính và dự phòng. Chức năng hỏi đáp được chấm bằng bộ câu hỏi có đáp án gửi qua đúng API của hệ thống, gồm cả câu hỏi nằm ngoài nội dung cuộc họp. Phần mềm được kiểm thử đơn vị và kiểm thử đầu-cuối trên Docker Compose.

## Đối tượng và phạm vi nghiên cứu

**Đối tượng nghiên cứu** gồm các kỹ thuật nhận dạng tiếng nói, tách người nói và trích xuất thông tin bằng LLM cho hội thoại cuộc họp; kiến trúc microservices hướng sự kiện và kiểm soát truy cập nhiều tầng; quy trình nghiệp vụ của cuộc họp nhóm từ chuẩn bị, ghi nhận, duyệt kết quả đến theo dõi công việc.

**Phạm vi nghiên cứu:** ngôn ngữ là tiếng Việt và tiếng Việt xen tiếng Anh; nền tảng họp trực tuyến là Google Meet (qua bot ghi âm và tiện ích đọc phụ đề), cuộc họp trực tiếp hoặc đã có bản ghi được đưa vào bằng tải tệp; đối tượng sử dụng là nhóm dự án nhỏ với cuộc họp ít người; nội dung được xử lý sau họp; hệ thống triển khai trên một máy chủ bằng Docker Compose, mô hình nhận dạng tiếng nói chạy trên CPU.

**Ngoài phạm vi:** Microsoft Teams và Zoom; phiên âm trực tiếp từ âm thanh trong lúc họp; nhận diện danh tính qua mẫu giọng; huấn luyện hay tinh chỉnh mô hình; mã hoá dữ liệu hội thoại khi lưu trữ (at-rest encryption) — hiện dữ liệu được bảo vệ bằng xác thực và phân quyền. Đồng bộ Jira và phát hiện rủi ro tự động mới ở mức thiết kế, chưa triển khai. Đồng bộ Trello và thông báo Telegram đã triển khai ở mức MVP; hỏi đáp RAG đã triển khai trong phạm vi tri thức của các cuộc họp thuộc một workspace; màn hình kết nối theo từng workspace và đồng bộ hai chiều trạng thái công việc nằm ngoài phạm vi của đề tài.

## Bố cục báo cáo

Ngoài Mở đầu và Kết luận và kiến nghị, báo cáo gồm bốn chương. Chương 1 trình bày cơ sở lý thuyết và công nghệ: bài toán trợ lý cuộc họp, nhận dạng tiếng nói, tách người nói, LLM trong trích xuất thông tin và hỏi đáp tăng cường truy xuất, kiến trúc microservices hướng sự kiện, thu nhận nội dung họp trực tuyến, tích hợp nền tảng quản lý công việc và kiểm soát truy cập. Chương 2 trình bày phân tích và thiết kế hệ thống MeetingMind: ca sử dụng, kiến trúc tổng thể, luồng xử lý và luồng sự kiện, cơ sở dữ liệu và phân quyền. Chương 3 trình bày xây dựng và triển khai: ba đường thu nhận, bot Google Meet, phiên âm hai lượt, tách người nói, phân tích bằng LLM, đồng bộ Trello và cảnh báo Telegram, hỏi đáp tri thức cuộc họp, giao diện và triển khai. Chương 4 trình bày thực nghiệm và đánh giá độ chính xác nhận dạng, tách người nói, chất lượng các LLM, chất lượng hỏi đáp tri thức và thời gian xử lý. Phần Kết luận và kiến nghị tổng kết kết quả so với đề cương, nêu hạn chế và hướng phát triển.
