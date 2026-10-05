# MeetingMind — Tổng quan dự án

Phiên bản 1.0 · 15/09/2026

Tài liệu này mô tả mục tiêu, người dùng, phạm vi chức năng, quy trình nghiệp vụ, phân quyền và yêu cầu chất lượng của MeetingMind. Đây là căn cứ chung để thống nhất yêu cầu, thiết kế, chia việc và nghiệm thu từng giai đoạn.

Đọc kèm:

- [ARCHITECTURE.md](ARCHITECTURE.md): các service, luồng sự kiện, nguyên tắc sở hữu dữ liệu
- [DATABASE_DESIGN.md](DATABASE_DESIGN.md): chi tiết bảng và cột

---

## 1. Thông tin chung

| Hạng mục | Nội dung |
| --- | --- |
| Tên dự án | MeetingMind |
| Loại sản phẩm | Website trợ lý cuộc họp và quản lý công việc sau họp, ứng dụng AI |
| Hình thức cuộc họp | Trực tuyến, trực tiếp tại phòng họp, nhập bản ghi có sẵn. Họp kết hợp là hướng mở rộng |
| Công nghệ cốt lõi | Chuyển giọng nói thành văn bản (STT), phân tách người nói, mô hình ngôn ngữ, hỏi đáp dựa trên tài liệu (RAG), tích hợp API |
| Người dùng | Owner/Admin workspace, PM/Team Lead, thành viên. Khách mời có phạm vi truy cập giới hạn |
| Nền tảng định hướng tích hợp | Google Meet, Teams, Zoom; lịch Google/Microsoft; Jira, Trello, Notion, Confluence, Slack, Telegram, Google Docs |
| Đầu ra | Transcript, ghi chú, biên bản, quyết định, vấn đề tồn đọng, đầu việc có liên kết nguồn |

**Quy ước thuật ngữ:** "họp offline" nghĩa là họp trực tiếp. Ghi âm khi mất Internet và chạy AI hoàn toàn không cần Internet là hai yêu cầu riêng, không gộp vào khái niệm này.

## 2. Bài toán

MeetingMind phủ toàn bộ vòng đời một cuộc họp: chuẩn bị, ghi nhận nội dung, xác nhận kết quả và theo dõi công việc sau họp.

1. **Chuẩn bị.** Người dùng tạo cuộc họp trong dự án, khai báo người tham gia và agenda, chọn cách ghi nhận: bot vào họp trực tuyến, ghi âm tại phòng họp, hoặc tải bản ghi có sẵn.
2. **Ghi nhận.** Hệ thống chuyển âm thanh thành văn bản, chia lượt nói, gắn thời gian. Người chủ trì gắn tên cho từng giọng nói, bổ sung vai trò, sửa đoạn nhận diện sai. Trong lúc họp, người dùng ghi chú, đánh dấu đoạn quan trọng và tạo đầu việc nháp.
3. **Tổng hợp.** Sau họp, AI kết hợp transcript và các ghi chú được phép dùng để tạo biên bản, quyết định, vấn đề chưa giải quyết và nhiệm vụ đề xuất. Mỗi nhiệm vụ liên kết tới đoạn hội thoại hoặc ghi chú nguồn.
4. **Duyệt.** Người quản lý kiểm tra nội dung, người phụ trách, thời hạn, mức ưu tiên rồi mới xác nhận, giao việc hoặc đồng bộ sang công cụ khác.
5. **Theo dõi.** Hệ thống theo dõi tiến độ, nhắc việc, cảnh báo theo quy tắc và cho phép hỏi đáp trên dữ liệu người dùng có quyền xem.

## 3. Vấn đề cần giải quyết

- Người tham gia vừa thảo luận vừa ghi chép, dễ bỏ sót nội dung.
- Bản ghi phòng họp không có tên tài khoản gắn với từng lượt nói.
- Khó phân biệt người đề xuất, người giao việc, người nhận việc và người duyệt.
- PM mất thời gian chuyển biên bản thành task, điền người thực hiện và deadline.
- Ý tưởng đang thảo luận dễ bị hiểu nhầm thành cam kết đã thống nhất.
- Task và quyết định thiếu nguồn kiểm chứng; thông tin phân tán ở nhiều công cụ.
- Khó phát hiện đầu việc thiếu người phụ trách, quá hạn hoặc bị chặn.
- Dữ liệu họp cũ khó tìm và khó kế thừa cho các cuộc họp sau.

## 4. Mục tiêu

- Ghi nhận và tổ chức nội dung họp trực tuyến lẫn trực tiếp trong một hệ thống.
- Xác định được ai phát biểu, ai được giao việc, ai xác nhận kết quả.
- Tạo ghi chú, biên bản, đầu việc có cấu trúc để giảm thao tác thủ công.
- Mọi kết quả AI đều có nguồn và được con người kiểm tra khi cần.
- Theo dõi việc thực hiện sau họp và truy lại lịch sử ra quyết định.
- Kiểm soát truy cập theo workspace, dự án và cuộc họp.

## 5. Người dùng và ba loại vai trò

### 5.1. Đối tượng sử dụng

| Đối tượng | Chức năng chính |
| --- | --- |
| Owner/Admin workspace | Quản lý thành viên, quyền, cấu hình tích hợp, lưu trữ, chính sách dữ liệu |
| PM/Team Lead | Quản lý dự án và cuộc họp; sửa biên bản; duyệt task; phân công; đồng bộ; theo dõi rủi ro |
| Member | Xem cuộc họp được chia sẻ; ghi chú theo quyền; xem và cập nhật việc được giao |
| Khách mời | Có trong danh sách tham dự; chỉ xem tài liệu khi được cấp quyền cụ thể |

### 5.2. Ba loại vai trò phải tách riêng

| Loại | Ví dụ | Cách xác định |
| --- | --- | --- |
| Quyền hệ thống | Owner, Admin, PM, Member, Viewer | Người có thẩm quyền cấu hình (xem [mục 13](#13-phân-quyền)) |
| Vai trò chuyên môn | Backend, Frontend, QA, BA, khách hàng | Hồ sơ thành viên trong dự án, đã được xác nhận |
| Vai trò trong cuộc họp / đầu việc | Chủ trì, thư ký, người đề xuất, người thực hiện, người duyệt | Khai báo trước họp hoặc xác nhận từ nội dung |

Nguyên tắc:

- Một người có thể giữ nhiều vai trò ở các phạm vi khác nhau.
- **AI không được tự cấp quyền hệ thống** dựa trên lời nói hay vai trò chuyên môn.
- Admin quản trị cấu hình **không mặc nhiên được đọc** mọi cuộc họp riêng tư; quyền đọc nội dung được quy định riêng.

## 6. Phạm vi chức năng

### 6.1. Tài khoản, workspace, dự án

- Đăng nhập, quản lý hồ sơ, tham gia workspace.
- Mời hoặc loại thành viên; cấp quyền theo dự án và cuộc họp.
- Tạo dự án với mô tả, danh sách thành viên và vai trò chuyên môn.
- Gắn cuộc họp, ghi chú, task vào dự án.
- Cấu hình múi giờ, ngôn ngữ, mẫu biên bản, quy tắc nhắc việc.

### 6.2. Chuẩn bị cuộc họp

- Nhập tiêu đề, thời gian, địa điểm hoặc link họp, mục tiêu, agenda.
- Chọn hình thức: online, trực tiếp, hoặc nhập bản ghi.
- Khai báo người tham dự, khách mời, người chủ trì, người ghi biên bản.
- Đính kèm tài liệu và các task còn tồn từ lần họp trước.
- Chọn nguồn thu âm; kiểm tra micro, nghe thử trước khi bắt đầu.
- Hiển thị thông báo ghi âm và lưu xác nhận theo quy trình của đơn vị.

### 6.3. Họp trực tuyến

- Dán link hoặc chọn cuộc họp từ lịch đã kết nối.
- Hiển thị trạng thái bot: đã lên lịch → đang chờ → đã tham gia → đang ghi → kết thúc, hoặc lỗi.
- Báo lỗi khi bot không được cho vào phòng hoặc mất kết nối.
- Lưu bản ghi và transcript vào đúng cuộc họp.
- Metadata người tham gia (nếu có) chỉ dùng để **hỗ trợ** gắn tên. Tên hiển thị không phải bằng chứng danh tính.

### 6.4. Họp trực tiếp

- Ghi âm bằng micro laptop, điện thoại hoặc micro phòng họp, tùy thiết bị.
- Bắt đầu, tạm dừng, tiếp tục, kết thúc; hiển thị thời lượng và mức tín hiệu.
- Ghi chú nhanh và đánh dấu đoạn quan trọng trong khi ghi.
- Nhập file ghi âm có sẵn, giữ thông tin nguồn và thời điểm họp do người dùng xác nhận.
- Lưu bản ghi theo từng phần; báo rõ đoạn bị gián đoạn nếu thu âm lỗi.
- Sau khi kết thúc, hiển thị tiến trình: tải lên → phiên âm → phân tích → hoàn tất.

**Ghi âm khi mất mạng** (giai đoạn sau): lưu tạm âm thanh trên thiết bị và tải lên khi có mạng lại. Danh sách thiết bị hỗ trợ được chốt qua kiểm thử dung lượng, quyền micro và chạy nền. AI thời gian thực có thể tạm ngừng khi mất mạng. Chạy STT/AI hoàn toàn trên thiết bị **không thuộc MVP**.

### 6.5. Phân tách và xác định người nói

Ba mức độc lập:

| Mức | Kết quả | Cách xử lý |
| --- | --- | --- |
| Phân tách người nói | Người nói 1, Người nói 2… | Nhóm lượt phát biểu theo giọng trong bản ghi |
| Gắn tên trong cuộc họp | Người nói 1 → Nguyễn Văn Nam | Chủ trì nghe mẫu, chọn người trong danh sách tham dự |
| Nhận diện qua mẫu giọng đã đăng ký | Đề xuất lượt nói thuộc về Nam | Mở rộng; cần đồng ý trước, xác nhận khi chưa chắc |

Yêu cầu:

- Mỗi đoạn có thời gian bắt đầu/kết thúc, nội dung, nhãn người nói và trạng thái xác nhận danh tính.
- Cho phép đổi tên nhãn, gộp nhãn trùng, tách đoạn bị gán sai.
- Sửa một đoạn, hoặc áp dụng cho mọi đoạn cùng nhãn sau khi xem trước.
- Không đủ căn cứ thì giữ **"Chưa xác định"**, không ép gán người.
- Đánh dấu đoạn nói chồng hoặc không nghe rõ để người dùng kiểm tra.
- Khi sửa người nói, đánh dấu các task liên quan **cần rà soát**; không âm thầm đổi người được giao trong task đã duyệt.

Phân biệt được hai giọng không có nghĩa là biết tên hai người đó. Lời tự giới thiệu đầu buổi chỉ là thông tin hỗ trợ, vẫn cần xác nhận khi âm thanh hoặc tên gọi mơ hồ.

### 6.6. Vai trò và trách nhiệm

- Ưu tiên vai trò chuyên môn đã khai báo trong dự án.
- Chủ trì chọn vai trò cuộc họp: điều phối, trình bày, thư ký, phê duyệt.
- AI có thể gợi ý trách nhiệm từ câu nói, kèm đoạn nguồn và trạng thái **"Cần xác nhận"**.
  - Ví dụ: "Nam xử lý API, Lan kiểm thử" → đề xuất người thực hiện và người kiểm thử cho đầu việc liên quan, **không** đổi chức danh của Nam hay Lan.
- Không suy ra quyền quyết định từ việc ai nói nhiều, nói to hay giọng tự tin.
- Phân biệt người đang nói với người được nhắc tới: "Lan làm phần này" không có nghĩa người nói là Lan.

### 6.7. Ghi chú và đầu việc trong lúc họp

- Soạn ghi chú văn bản, checklist, tag, liên kết tài liệu.
- Phân loại ghi chú: thông tin, câu hỏi, ý tưởng, quyết định, đầu việc, vấn đề cần làm rõ.
- Gắn ghi chú với thời điểm ghi âm và mục agenda; bấm vào để nghe lại đoạn liên quan.
- Chọn một đoạn transcript để tạo ghi chú hoặc task nháp.
- Nhập nhanh đầu việc, người dự kiến phụ trách, hạn dự kiến.
- Tách ghi chú **cá nhân** và **chia sẻ**. Ghi chú cá nhân chỉ được đưa vào biên bản chung khi chủ sở hữu cho phép.
- Giữ riêng ba loại nội dung: lời nói gốc, nội dung người dùng ghi, nội dung AI đề xuất.
- Mở rộng: nhiều người cùng ghi chú, thấy thay đổi của nhau theo thời gian thực.

### 6.8. Transcript và biên bản

- Transcript theo người nói và thời gian; tìm kiếm, chỉnh sửa, phát lại đúng đoạn.
- Lưu lịch sử sửa để truy lại phiên bản nguồn.
- Biên bản theo mẫu: mục tiêu, người tham dự, nội dung theo agenda, quyết định, task, vấn đề còn mở, bước tiếp theo.
- Mẫu có sẵn: họp tiến độ, lập kế hoạch, họp khách hàng, tổng kết.
- Tạo lại biên bản từ transcript đã sửa; lưu thành phiên bản mới để không mất nội dung đã duyệt trước đó.
- Trạng thái biên bản: **nháp → chờ duyệt → đã duyệt**.
- Xuất hoặc chia sẻ trong phạm vi quyền; các định dạng xuất làm dần theo giai đoạn.

### 6.9. Trích xuất và duyệt đầu việc

| Trường | Ý nghĩa |
| --- | --- |
| Tiêu đề / mô tả | Việc cụ thể và kết quả cần đạt |
| Người đề xuất / giao việc | Người đưa yêu cầu, nếu xác định được |
| Người thực hiện | Người nhận trách nhiệm; được phép để trống |
| Người phối hợp / người duyệt | Chỉ điền khi có căn cứ hoặc do người quản lý điền |
| Deadline | Ngày giờ đã chuẩn hóa, kèm câu nói gốc và múi giờ |
| Ưu tiên | Do cuộc họp nêu rõ hoặc PM xác nhận |
| Điều kiện hoàn thành | Lấy từ nội dung họp hoặc người quản lý bổ sung |
| Phụ thuộc | Việc phải xong trước, hoặc điều kiện đang chờ |
| Nguồn | Đoạn transcript/ghi chú, người nói, thời điểm, phiên bản |
| Trạng thái duyệt | Đề xuất, Cần làm rõ, Đã duyệt, Bị loại |
| Trạng thái thực hiện | Todo, In Progress, Blocked, Done |

Quy tắc:

- AI phân biệt **đề xuất** ("hay là làm X") với **cam kết** ("thống nhất làm X").
- Thiếu người thực hiện hoặc deadline thì để trống và đánh dấu. **Không tự bịa.**
- Với "thứ Sáu", "mai"…, hệ thống dựa vào ngày họp và múi giờ để đề xuất ngày cụ thể. Câu mơ hồ phải được xác nhận.
- Người quản lý có thể sửa, tách, gộp, loại task. Hệ thống gợi ý trùng lặp nhưng không tự gộp.
- Chỉ task **đã duyệt** mới được giao chính thức hoặc đưa vào hàng đợi đồng bộ.
- Trạng thái duyệt và trạng thái thực hiện là hai thuộc tính độc lập. Blocked là trạng thái khi gặp trở ngại, không phải bước bắt buộc.

### 6.10. Task Board và theo dõi sau họp

- Xem dạng bảng hoặc danh sách; lọc theo dự án, cuộc họp, người phụ trách, deadline, trạng thái.
- Thành viên cập nhật tiến độ, bình luận, đính kèm kết quả, ghi lý do bị chặn.
- Từ task mở được quyết định và đoạn hội thoại nguồn.
- Nhắc việc sắp đến hạn, quá hạn, bị chặn theo quy tắc cấu hình.
- Gom các đầu việc còn mở vào agenda cuộc họp tiếp theo.

### 6.11. Cảnh báo rủi ro

- Phát hiện task quá hạn, thiếu người phụ trách, phụ thuộc chưa xong.
- Nhiều deadline dồn vào một người được hiển thị như dấu hiệu cần rà soát.
- Chỉ kết luận **quá tải** khi có dữ liệu phù hợp (effort ước tính, năng lực khả dụng). Đếm số task thôi là không đủ.
- Mỗi cảnh báo phải nêu quy tắc và dữ liệu đã sinh ra nó.
- PM xác nhận, bỏ qua hoặc điều chỉnh. AI không tự đổi deadline hay phân công.

### 6.12. Kho ghi chú và RAG Chat

- Tổ chức ghi chú/biên bản theo workspace, dự án, cuộc họp, thời gian, tag.
- Tìm theo nội dung, người nói, quyết định, đầu việc.
- Hỏi đáp kiểu "Cuộc họp trước thống nhất gì về đăng nhập?", "Vì sao task này bị hoãn?".
- Câu trả lời kèm nguồn, cuộc họp và thời điểm; nói rõ khi thông tin chưa được xác nhận hoặc có mâu thuẫn.
- Không đủ nguồn thì trả lời **chưa đủ thông tin**.
- **Lọc quyền trước khi truy xuất** và kiểm tra lại quyền khi mở nguồn. Người dùng không truy vấn được nội dung mình không có quyền xem.
- Khi nguồn bị sửa, xóa hoặc quyền thay đổi, chỉ mục được cập nhật theo.

### 6.13. Tích hợp

- Kết nối lịch để chọn cuộc họp và lấy metadata trong phạm vi được cấp.
- Đồng bộ task đã duyệt sang Jira hoặc Trello; map dự án, người dùng, trạng thái.
- Lưu ID bên ngoài, trạng thái đồng bộ, số lần thử, lỗi.
- Thử lại không tạo bản trùng; trường không map được thì hiển thị để người dùng sửa.
- MVP: **một chiều, một công cụ**. Đồng bộ hai chiều cần quy tắc xử lý xung đột và xác định nguồn dữ liệu chính.
- Notion / Confluence / Google Docs dùng cho biên bản; Slack / Telegram dùng cho thông báo ở giai đoạn sau.

### 6.14. Dashboard

- Cuộc họp sắp tới, đang xử lý, lỗi, hoàn tất.
- Biên bản và task chờ duyệt; số task chưa có người phụ trách.
- Công việc theo trạng thái, người thực hiện, thời hạn.
- Cảnh báo đang mở và kết quả đồng bộ.
- **Không** dùng thời lượng phát biểu để đánh giá năng lực hay hiệu suất cá nhân.

## 7. Quy trình mẫu: họp trực tiếp

1. PM tạo cuộc họp, chọn dự án, khai báo agenda và người tham gia.
2. PM thông báo ghi âm, kiểm tra micro, bắt đầu ghi.
3. Hệ thống thu âm; người dùng ghi chú, đánh dấu thời điểm, tạo đầu việc nháp.
4. STT và phân tách người nói chạy trực tiếp hoặc sau họp, tùy chế độ đã triển khai.
5. PM nghe mẫu để gắn Người nói 1/2… với tên thật; xác nhận vai trò khi cần.
6. AI tạo transcript, biên bản, quyết định và task có nguồn.
7. PM sửa các mục chưa rõ, duyệt biên bản và task.
8. Task đã duyệt lên Task Board và được đồng bộ ra ngoài nếu người dùng chọn.
9. Thành viên cập nhật tiến độ; đầu việc còn tồn được đưa vào cuộc họp sau.

**Ví dụ minh họa.** Ở phút 12:35, Minh (đã được xác nhận danh tính) nói: *"Nam phụ trách API đăng nhập, thứ Sáu gửi bản đầu tiên để Lan kiểm thử."*

- Hệ thống đề xuất task "API đăng nhập", người thực hiện là Nam, liên kết tới câu nguồn.
- Đề xuất thêm một hoạt động kiểm thử liên quan đến Lan.
- "Thứ Sáu" được chuẩn hóa thành ngày cụ thể để PM kiểm tra.
- Câu nói không nêu hạn hoàn thành kiểm thử và người duyệt cuối, nên hai trường này **để trống**.

## 8. Màn hình chính

| Màn hình | Nội dung |
| --- | --- |
| Dashboard | Tổng quan cuộc họp, đầu việc, mục chờ duyệt |
| Workspace / Project | Thành viên, vai trò, cuộc họp, cấu hình |
| Tạo cuộc họp | Hình thức, lịch, agenda, người tham gia, nguồn âm thanh |
| Ghi âm trực tiếp | Micro, thời lượng, tạm dừng, ghi chú, đánh dấu, task nháp |
| Chi tiết cuộc họp | Audio, transcript, người nói, ghi chú, biên bản, quyết định, task |
| Xác nhận người nói | Nghe mẫu, gắn tên, sửa nhãn, xử lý "chưa xác định" |
| Duyệt đầu việc | Đặt đề xuất cạnh nguồn, sửa người/hạn, duyệt hoặc loại |
| Task Board | Theo dõi và cập nhật công việc |
| Notebook / RAG Chat | Tìm kiếm, ghi chú, hỏi đáp có nguồn |
| Integrations / Settings | Kết nối, mapping, quyền, quy tắc lưu trữ |

## 9. Dữ liệu nghiệp vụ chính

Thực thể: User, Workspace, WorkspaceMembership, Project, ProjectMembership, Meeting, MeetingParticipant, Recording, TranscriptSegment, SpeakerLabel, SpeakerAssignment, Note, MinutesVersion, Decision, ActionItem, Task, TaskSource, IntegrationConnection, SyncJob, AuditLog.

- **MeetingParticipant** có thể là khách chưa có tài khoản.
- **SpeakerLabel** thuộc về bản ghi/cuộc họp, chỉ liên kết với người tham gia sau khi được xác nhận.
- **SpeakerProfile** (mẫu giọng) chỉ thêm khi làm tính năng nâng cao.
- **TaskSource** giữ liên kết nguồn và phiên bản nguồn tại thời điểm duyệt.
- Vai trò được lưu theo đúng phạm vi của nó. **Không dùng một cột `role` duy nhất** cho cả quyền workspace, vai trò chuyên môn và trách nhiệm trong task.

Chi tiết bảng xem [DATABASE_DESIGN.md](DATABASE_DESIGN.md).

## 10. Yêu cầu chất lượng và dữ liệu

- Ưu tiên tiếng Việt; đánh giá riêng trường hợp xen thuật ngữ tiếng Anh.
- Lưu file gốc và trạng thái từng bước xử lý; thử lại bước lỗi mà không sinh task trùng.
- Hiển thị trạng thái thật: không báo hoàn tất khi transcript/AI chưa xong.
- Kiểm soát truy cập nhất quán cho audio, transcript, ghi chú, task và nguồn RAG.
- Có quy tắc thời hạn lưu, xóa bản ghi, và xóa luôn dữ liệu dẫn xuất tương ứng.
- Ghi nhật ký thay đổi người nói, biên bản, phân công, tích hợp.
- Mẫu giọng là dữ liệu nhạy cảm: đăng ký tự nguyện, giới hạn mục đích, kiểm soát truy cập, xóa được; không thu thập ngầm.
- Đo chất lượng trên dữ liệu phòng họp thực tế: người nói xa micro, có nhiễu, nói chồng. **Chưa cam kết tỷ lệ chính xác** trước khi có baseline.

## 11. Phân kỳ triển khai

| Giai đoạn | Phạm vi |
| --- | --- |
| **MVP** | Tài khoản/dự án; họp trực tiếp và nhập file; ghi chú gắn thời gian; STT sau họp; phân tách người nói và gắn tên thủ công; biên bản/task nháp; PM duyệt; Task Board; RAG có nguồn và kiểm soát quyền |
| **Tiếp theo** | Bot cho một nền tảng; kết nối lịch; đồng bộ một chiều Jira hoặc Trello; mẫu biên bản; nhắc việc; ghi âm khi mất mạng trên thiết bị đã kiểm thử |
| **Nâng cao** | Nhận diện qua mẫu giọng tự nguyện; transcript trực tiếp; họp kết hợp; ghi chú cộng tác; đồng bộ hai chiều; đánh giá tải công việc theo effort; mind map/slide |

Mỗi giai đoạn chỉ làm các tích hợp đã có trong kế hoạch. Danh sách nền tảng ở [mục 1](#1-thông-tin-chung) là định hướng sản phẩm, không có nghĩa MVP có đủ tất cả.

## 12. Tiêu chí nghiệm thu

| Nhóm | Điều kiện kiểm chứng |
| --- | --- |
| Ghi âm | Phát lại được; tạm dừng/tiếp tục đúng; lỗi micro hoặc gián đoạn được báo |
| Transcript | Có mốc thời gian, nhãn người nói, cho phép sửa; đo lỗi nhận dạng trên bộ mẫu đã gán nhãn |
| Người nói | Gắn tên và sửa nhãn được; không tự khẳng định danh tính khi không chắc |
| Vai trò | Vai trò AI gợi ý không làm thay đổi quyền hệ thống |
| Ghi chú | Ghi chú gắn thời gian mở đúng đoạn; ghi chú riêng không vào biên bản chung khi chưa cho phép |
| Task | Có nguồn; trường thiếu được đánh dấu; phân biệt nháp và đã duyệt; không tự giao task chưa duyệt |
| Deadline | Giữ câu gốc; chuẩn hóa theo ngày họp và múi giờ; yêu cầu làm rõ khi mơ hồ |
| Đồng bộ | Retry không tạo trùng; lỗi mapping được hiển thị |
| RAG | Nguồn phù hợp; từ chối kết luận khi thiếu dữ liệu; không lộ dữ liệu ngoài quyền |
| Sửa / xóa | Cập nhật phiên bản và chỉ mục; task đã duyệt không bị thay đổi ngầm khi sửa transcript |

**Bộ dữ liệu thử nên có:** họp ít người yên tĩnh; họp đông người; âm thanh nhiễu; nói chồng; khách chưa có tài khoản; hai người trùng tên; câu giao việc thiếu deadline; lời nói thay đổi quyết định trước đó.

**Đo riêng từng loại lỗi:** STT, phân tách người nói, gán danh tính, độ đúng của task / người thực hiện / deadline, và thời gian PM cần để sửa. Ngưỡng nghiệm thu chốt sau khi có baseline.

## 13. Phân quyền

MeetingMind dùng **phân quyền theo vai trò kết hợp phạm vi tài nguyên**: quyền của một người phụ thuộc vào vai trò của họ trong workspace, trong project và trong cuộc họp cụ thể.

> Ví dụ: bạn là **Member của workspace** nhưng là **PM của Project A** → bạn quản lý được Project A, nhưng không tự động quản lý được Project B.

### 13.1. Các vai trò

| Phạm vi | Vai trò | Trách nhiệm |
| --- | --- | --- |
| Hệ thống | `SUPER_ADMIN` | Quản trị nền tảng MeetingMind |
| Hệ thống | `USER` | Người dùng thông thường |
| Workspace | `OWNER` | Chủ sở hữu, quản lý toàn bộ workspace |
| Workspace | `ADMIN` | Quản lý thành viên, cấu hình, hoạt động workspace |
| Workspace | `MEMBER` | Tham gia các project/cuộc họp được cấp quyền |
| Workspace | `VIEWER` | Chỉ xem tài nguyên được cấp quyền |
| Project | `PM` | Quản lý project, cuộc họp, biên bản, công việc |
| Project | `MEMBER` | Tham gia cuộc họp, thực hiện công việc |
| Project | `VIEWER` | Xem nội dung project |
| Meeting độc lập | `MANAGER` | Quản lý meeting, transcript, duyệt biên bản và đề xuất |
| Meeting độc lập | `EDITOR` | Sửa transcript, biên bản nháp, đề xuất; không duyệt, không xóa |
| Meeting độc lập | `VIEWER` | Xem meeting, nghe audio, xem transcript/biên bản |

`PM` là vai trò **trong project**, không phải vai trò workspace.

Ký hiệu trong các ma trận dưới đây: **✓** được phép · **—** không được phép · chữ = được phép có điều kiện.

### 13.2. Quản trị workspace

Xét theo vai trò workspace.

| Chức năng | Owner | Admin | Member | Viewer |
| --- | :---: | :---: | :---: | :---: |
| Xem thông tin workspace | ✓ | ✓ | ✓ | ✓ |
| Sửa tên, ảnh, múi giờ | ✓ | ✓ | — | — |
| Xem danh sách thành viên cơ bản | ✓ | ✓ | ✓ | ✓ |
| Mời Member/Viewer | ✓ | ✓ | — | — |
| Đổi Member ↔ Viewer | ✓ | ✓ | — | — |
| Bổ nhiệm hoặc gỡ Admin | ✓ | — | — | — |
| Vô hiệu hóa/xóa Member, Viewer | ✓ | ✓ | — | — |
| Chuyển quyền sở hữu | ✓ | — | — | — |
| Cấu hình lưu trữ, tự động vào họp | ✓ | ✓ | — | — |
| Quản lý gói dịch vụ, thanh toán | ✓ | — | — | — |
| Xem nhật ký quản trị | ✓ | ✓ | — | — |
| Xóa workspace | ✓ | — | — | — |
| Rời workspace | Phải chuyển Owner trước | ✓ | ✓ | ✓ |

Mỗi workspace có đúng **một Owner đang hoạt động**. Admin không được thay đổi hay vô hiệu hóa Owner và các Admin khác.

### 13.3. Quản lý project

Owner/Admin quản lý được mọi project trong workspace. Các cột PM / Member / Viewer là vai trò **trong project đang thao tác**.

| Chức năng | Owner/Admin | PM | Member | Viewer |
| --- | :---: | :---: | :---: | :---: |
| Tạo project | ✓ | — | — | — |
| Xem project | ✓ | ✓ | ✓ | ✓ |
| Sửa thông tin project | ✓ | ✓ | — | — |
| Lưu trữ / khôi phục project | ✓ | ✓ | — | — |
| Xóa project | ✓ | — | — | — |
| Thêm thành viên workspace vào project | ✓ | ✓ | — | — |
| Gỡ Member/Viewer khỏi project | ✓ | ✓ | — | — |
| Đổi Member ↔ Viewer trong project | ✓ | ✓ | — | — |
| Bổ nhiệm / gỡ PM | ✓ | — | — | — |
| Xem thống kê project | ✓ | ✓ | ✓ | ✓ |

- Người không thuộc project không xem được project (trừ Owner/Admin).
- PM muốn thêm người chưa ở trong workspace phải nhờ Owner/Admin mời trước.

### 13.4. Cuộc họp, audio, transcript

Meeting thuộc project kế thừa quyền của project.

| Chức năng | Owner/Admin | PM | Member | Viewer |
| --- | :---: | :---: | :---: | :---: |
| Xem danh sách / chi tiết cuộc họp | ✓ | ✓ | ✓ | ✓ |
| Tạo cuộc họp hoặc upload audio | ✓ | ✓ | ✓ | — |
| Sửa lịch / link / thông tin | ✓ | ✓ | Cuộc họp mình tạo | — |
| Hủy lịch bot | ✓ | ✓ | Cuộc họp mình tạo | — |
| Yêu cầu bot vào / dừng ghi | ✓ | ✓ | Cuộc họp mình tạo | — |
| Nghe audio trên ứng dụng | ✓ | ✓ | ✓ | ✓ |
| Tải audio gốc | ✓ | ✓ | — | — |
| Xem transcript | ✓ | ✓ | ✓ | ✓ |
| Sửa transcript / gán tên speaker | ✓ | ✓ | Cuộc họp mình tạo | — |
| Chạy lại phiên âm / phân tích AI | ✓ | ✓ | — | — |
| Xóa cuộc họp | ✓ | ✓ | — | — |

- Quyền "cuộc họp mình tạo" chỉ còn hiệu lực khi người đó **vẫn có quyền vào project**.
- Meeting **không thuộc project** dùng vai trò `MANAGER` / `EDITOR` / `VIEWER` (mục 13.1). Người tạo được gán `MANAGER`. Owner/Admin vẫn có quyền quản trị.
- **`meeting_participants` chỉ ghi nhận người tham dự, không cấp quyền truy cập.** Người có mặt trong Google Meet hay được AI nhận ra tên chưa chắc đã được phép xem dữ liệu trên MeetingMind.

### 13.5. Biên bản và hàng đợi duyệt

| Chức năng | Owner/Admin | PM | Member | Viewer |
| --- | :---: | :---: | :---: | :---: |
| Xem biên bản đã duyệt | ✓ | ✓ | ✓ | ✓ |
| Xem biên bản nháp / đề xuất AI | ✓ | ✓ | ✓ | — |
| Sửa biên bản nháp | ✓ | ✓ | Cuộc họp mình tạo | — |
| Sửa đề xuất công việc trước khi duyệt | ✓ | ✓ | Cuộc họp mình tạo | — |
| Duyệt / từ chối đề xuất AI | ✓ | ✓ | — | — |
| Duyệt biên bản | ✓ | ✓ | — | — |
| Mở phiên bản nháp mới từ bản đã duyệt | ✓ | ✓ | — | — |
| Xuất biên bản đã duyệt ra file | ✓ | ✓ | ✓ | — |
| Xuất sang Notion / Confluence / Google Docs | ✓ | ✓ | — | — |

Biên bản đã duyệt **không sửa trực tiếp**: phải mở phiên bản nháp mới rồi duyệt lại. Xuất ra nền tảng ngoài còn phụ thuộc quyền dùng kết nối tương ứng.

### 13.6. Công việc

Task trong project là tài nguyên mà mọi thành viên project được xem.

| Chức năng | Owner/Admin | PM | Member | Viewer |
| --- | :---: | :---: | :---: | :---: |
| Xem task và citation | ✓ | ✓ | ✓ | ✓ |
| Tạo task thủ công | ✓ | ✓ | ✓ | — |
| Gán task cho người khác | ✓ | ✓ | — | — |
| Tạo task cho bản thân / chưa phân công | ✓ | ✓ | ✓ | — |
| Sửa tiêu đề, mô tả | ✓ | ✓ | Task giao cho mình | — |
| Đổi deadline / priority | ✓ | ✓ | — | — |
| Cập nhật trạng thái tiến độ | ✓ | ✓ | Task giao cho mình | — |
| Bình luận | ✓ | ✓ | ✓ | — |
| Sửa / xóa bình luận của mình | ✓ | ✓ | ✓ | — |
| Xóa bình luận của người khác | ✓ | ✓ | — | — |
| Xóa / khôi phục task | ✓ | ✓ | — | — |
| Xem lịch sử thay đổi | ✓ | ✓ | ✓ | ✓ |
| Duyệt đề xuất AI thành task chính thức | ✓ | ✓ | — | — |

- Member tạo task chỉ được chọn chính mình hoặc để chưa phân công. Người tạo task **không giữ quyền sửa vĩnh viễn** sau khi task đã giao cho người khác.
- Task sinh từ meeting độc lập kế thừa quyền của meeting đó; assignee phải là thành viên workspace có quyền xem meeting nguồn.
- **Được gán task không có nghĩa là được xem transcript.**

### 13.7. Tích hợp và đồng bộ

| Chức năng | Owner/Admin | PM | Member | Viewer |
| --- | :---: | :---: | :---: | :---: |
| Kết nối / ngắt Calendar cá nhân | ✓ | ✓ | ✓ | — |
| Xem dữ liệu Calendar cá nhân | Chỉ của mình | Chỉ của mình | Chỉ của mình | — |
| Tạo / ngắt kết nối Jira, Trello, Notion của workspace | ✓ | — | — | — |
| Chọn project được dùng kết nối | ✓ | — | — | — |
| Chọn board/project đích (từ danh sách được cấp) | ✓ | ✓ | — | — |
| Đồng bộ task chính thức | ✓ | ✓ | — | — |
| Retry job đồng bộ lỗi | ✓ | Trong project | — | — |
| Xem trạng thái đồng bộ task | ✓ | ✓ | ✓ | ✓ |
| Xem chi tiết lỗi (đã lọc thông tin nhạy cảm) | ✓ | Trong project | — | — |
| Đọc token / secret qua API hoặc UI | — | — | — | — |

Owner/Admin **không mặc nhiên đọc được lịch cá nhân** của thành viên. Chỉ những cuộc họp đã được đưa vào workspace mới chịu chính sách quyền của workspace.

### 13.8. Chatbot, tìm kiếm, cảnh báo

| Chức năng | Owner/Admin | PM | Member | Viewer |
| --- | :---: | :---: | :---: | :---: |
| Tìm kiếm dữ liệu được phép xem | ✓ | ✓ | ✓ | ✓ |
| Hỏi chatbot trên dữ liệu được phép xem | ✓ | ✓ | ✓ | ✓ |
| Xem citation và mở nguồn | ✓ | ✓ | ✓ | ✓ |
| Xem / xóa hội thoại của mình | ✓ | ✓ | ✓ | ✓ |
| Xem chat riêng của người khác | — | — | — | — |
| Xem cảnh báo rủi ro của project | ✓ | ✓ | — | — |
| Xem cảnh báo liên quan task của mình | ✓ | ✓ | ✓ | — |
| Xác nhận / đóng cảnh báo | ✓ | ✓ | — | — |
| Cấu hình quy tắc phát hiện rủi ro | ✓ | — | — | — |

- Viewer được hỏi chatbot vì đó là thao tác đọc, nhưng vẫn chịu giới hạn sử dụng của workspace.
- **Chatbot không được trả lời từ nội dung người hỏi không có quyền xem**, kể cả khi nội dung đó đã nằm trong vector database.

### 13.9. Super Admin

`SUPER_ADMIN` quản trị nền tảng, tách biệt hoàn toàn với quyền đọc nội dung của khách hàng.

| Chức năng | Super Admin |
| --- | :---: |
| Xem tình trạng vận hành, số workspace, mức sử dụng | ✓ |
| Khóa / mở tài khoản hoặc workspace theo quy trình | ✓ |
| Quản lý gói dịch vụ, cấu hình hệ thống | ✓ |
| Xem log kỹ thuật đã lọc nội dung nhạy cảm | ✓ |
| Mặc định đọc audio, transcript, task, chat riêng | — |
| Mặc định vào workspace với quyền Owner | — |

Nếu sau này cần hỗ trợ truy cập nội dung khách hàng, phải thiết kế cơ chế cấp quyền tạm thời riêng, có thời hạn và có audit.

### 13.10. Thứ tự kiểm tra quyền

Backend kiểm tra lần lượt:

1. Tài khoản đang hoạt động, workspace không bị khóa.
2. Người dùng có membership workspace ở trạng thái `active` (`invited` chưa có quyền).
3. Tài nguyên thực sự thuộc workspace đang xét.
4. Người dùng có quyền vào project / meeting tương ứng.
5. Vai trò cho phép hành động.
6. Điều kiện bổ sung: là người tạo, là assignee, tài nguyên đang ở trạng thái nháp, kết nối đã được cấp quyền…

Quy tắc chốt:

- **Workspace Viewer là giới hạn chỉ đọc**: không được gán làm PM hay Member trong project.
- Workspace Member có thể làm PM ở từng project.
- Owner/Admin quản trị project theo ma trận nhưng không đọc được chat hay Calendar riêng của người khác.
- Bị gỡ khỏi workspace là mất quyền, kể cả khi bản ghi project membership vẫn còn.
- Thay đổi quyền phải có hiệu lực đồng thời trên REST API, WebSocket, tải file và RAG.

### 13.11. Thay đổi database tương ứng

| Bảng | Thay đổi |
| --- | --- |
| `workspace_members` | `role`: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` |
| `project_members` | `role`: `PM`, `MEMBER`, `VIEWER` |
| `meetings` | Thêm `accessScope`: `project` hoặc `restricted` (meeting không có project dùng `restricted`) |
| `meeting_access` *(mới)* | `workspaceId`, `meetingId`, `userId`, `role`, `grantedById`, timestamps; unique `(meetingId, userId)` |
| `integrations` | Thêm `connectionScope`: `personal` / `workspace`; `ownerUserId` cho kết nối cá nhân |
| `integration_project_access` *(mới)* | `workspaceId`, `integrationId`, `projectId`; do Integration quản lý |
| `audit_logs` *(mới)* | Người thực hiện, hành động, tài nguyên, workspace, thời điểm, thay đổi quyền |

Tham chiếu giữa Core và Integration vẫn là ID logic, không khai báo FK (xem [ARCHITECTURE.md](ARCHITECTURE.md) mục 3.2).

### 13.12. Cách triển khai

MVP **không cần** hệ thống role tùy biến. Permission được định nghĩa trong code theo dạng `<tài nguyên>.<hành động>`, ví dụ:

```text
workspace.member.invite    workspace.settings.update   project.member.manage
meeting.create             meeting.update              meeting.recording.control
transcript.update          minutes.approve             review.approve
task.assign                task.status.update          integration.manage
sync.request               chat.query
```

Danh mục đầy đủ: [core-service/src/modules/permission/common/constant.ts](core-service/src/modules/permission/common/constant.ts).

Trách nhiệm từng service:

- **Core** là nơi duy nhất quyết định quyền nghiệp vụ.
- **Gateway** chỉ kiểm tra token.
- **AI** và **Integration** hỏi Core qua API nội bộ để xác minh quyền trước khi truy cập dữ liệu hoặc thực hiện hành động.
- **Worker** chỉ nhận job do backend đã xác thực phát ra, và dùng danh tính service riêng.

## 14. Giới hạn phạm vi và nguyên tắc triển khai

- MVP ưu tiên xử lý **sau** cuộc họp. Phiên âm trực tiếp và nhận diện qua mẫu giọng thuộc giai đoạn nâng cao.
- Ngôn ngữ ưu tiên là tiếng Việt, có kiểm thử hội thoại xen thuật ngữ tiếng Anh.
- Thiết bị, thời lượng bản ghi, số người tham dự, giới hạn dung lượng được chốt trong đặc tả kỹ thuật và kiểm chứng trước khi phát hành.
- Vai trò AI gợi ý không thay đổi quyền truy cập và không tự xác nhận trách nhiệm của ai.
- Tích hợp nền tảng ngoài phụ thuộc phạm vi API, quyền được cấp và điều kiện vận hành của nền tảng đó.
- Ngân sách AI, chính sách lưu bản ghi, giới hạn sử dụng được cấu hình theo kế hoạch vận hành.
- Chức năng ngoài phạm vi giai đoạn hiện tại được đưa vào danh sách yêu cầu mở rộng, làm sau khi xong phần cốt lõi.

## 15. Kết quả bàn giao

- Website quản lý workspace, dự án, cuộc họp và công việc theo phân quyền.
- Ghi âm họp trực tiếp, nhập bản ghi, ghi chú gắn thời gian.
- Quy trình tạo transcript, phân tách người nói, xác nhận danh tính.
- Biên bản, quyết định, đầu việc do AI đề xuất, có nguồn kiểm chứng và bước duyệt.
- Bảng theo dõi công việc: trạng thái, trách nhiệm, thời hạn.
- Kho ghi chú và hỏi đáp nội dung cuộc họp theo quyền truy cập.
- Kết nối họp trực tuyến, lịch, quản lý công việc theo từng giai đoạn.
- Tài liệu yêu cầu, thiết kế, hướng dẫn sử dụng, báo cáo kiểm thử theo phạm vi nghiệm thu.
