# Xây dựng hệ thống

Chương này trình bày việc hiện thực hoá thiết kế ở chương Phân tích và thiết kế thành hệ thống MeetingMind chạy được: môi trường phát triển, dịch vụ lõi, ba đường thu nhận nội dung cuộc họp, ba mô-đun trí tuệ nhân tạo, luồng duyệt công việc, mô-đun đồng bộ Trello và cảnh báo Telegram, mô-đun hỏi đáp tri thức cuộc họp, giao diện web, triển khai và kiểm thử. Mỗi phần nêu cả khó khăn khi chạy thật và cách xử lý. Những hạng mục mới ở mức thiết kế (đồng bộ Jira, phát hiện rủi ro tự động, mã hoá dữ liệu khi lưu) không được mô tả như đã chạy.

Nhóm nghiên cứu xây dựng theo kiểu "lát cắt dọc": trước hết làm thông toàn bộ đường đi của dữ liệu bằng các thành phần giả lập (stub), sau đó thay dần bằng thành phần thật. Lịch sử commit phản ánh đúng trình tự này: giữa tháng 9/2026 tách schema theo dịch vụ, áp ma trận phân quyền, làm thông luồng outbox → RabbitMQ → AI giả lập → biên bản nháp, thêm đường tải tệp và đường extension; cuối tháng 10/2026 sửa extension sau khi thử trên Google Meet thật, vá lỗ hổng bảo mật, nối giao diện; đầu tháng 11/2026 gắn Whisper, tách người nói, bot và LLM thật, sau đó hiện thực đồng bộ công việc đã duyệt sang Trello và Telegram, cuối cùng là hỏi đáp tri thức cuộc họp có trích nguồn.

## Môi trường và công cụ phát triển

Hệ thống gồm năm dịch vụ backend, một ứng dụng web và một tiện ích mở rộng trình duyệt. Dịch vụ lõi (core-service), cổng API (api-gateway) và dịch vụ tích hợp (integration-service) viết bằng TypeScript trên NestJS [@nestjs]; api-gateway hiện mới là khung dựng từ mẫu NestJS, còn integration-service đã có mô-đun đồng bộ công việc sang Trello và Telegram. Phần xử lý AI (ai-worker và ai-service, dùng chung mã nguồn) và bot ghi âm (bot-worker) viết bằng Python vì hệ sinh thái thư viện phù hợp. Bảng [[tb-tools]] liệt kê công cụ chính với phiên bản lấy từ `package.json`, `requirements.txt` và `Dockerfile`.

::table tb-tools | Ngôn ngữ, framework và thư viện chính dùng để xây dựng hệ thống
| Thành phần | Công nghệ và phiên bản | Vai trò |
|---|---|---|
| core-service | Node.js 22, TypeScript 5.8.3, NestJS 11.1.3 | Khung ứng dụng, module, guard |
| core-service | Sequelize 6.37.7, sequelize-typescript 2.1.6 | Truy cập PostgreSQL |
| core-service | @golevelup/nestjs-rabbitmq 6.0.1, minio 8.0.5 | Sự kiện RabbitMQ; ghi object, ký URL |
| core-service | @nestjs/jwt 11.0.0, bcryptjs 3.0.2 | Xác thực JWT, băm mật khẩu |
| integration-service | NestJS 11.1.3, @golevelup/nestjs-rabbitmq 6.0.1, Jest 30.0.0 | Nhận sự kiện, gọi Trello REST API và Telegram Bot API, kiểm thử |
| ai-worker | Python 3.12.3, aio-pika 9.5.5, httpx 0.26.0 | Nhận việc từ RabbitMQ, gọi API LLM |
| ai-worker | faster-whisper 1.2.1, PyAV 18.1.0 | Nhận dạng tiếng nói, giải mã âm thanh |
| ai-worker | sherpa-onnx 2.0.1, NumPy 2.2.5 | Vector đặc trưng giọng, gom cụm |
| ai-service | FastAPI 0.115.12, psycopg2 2.9.10, pypdf 6.21.4, python-docx 1.2.0 | API hỏi đáp nội bộ, truy vấn pgvector, tách chữ tài liệu |
| bot-worker | Playwright 1.64.1 (Chromium), Xvfb, PulseAudio | Vào Google Meet trên màn hình và loa ảo |
| Extension | Chrome Manifest V3, node:test | Đọc phụ đề Meet, kiểm thử |
| Frontend | Next.js 16.3.8, React 19.2.8, Tailwind CSS 4.3, shadcn/Radix UI | Ứng dụng web |
| Hạ tầng | PostgreSQL 15 (pgvector 0.8.6), RabbitMQ 3.11, Redis 7, MinIO | Lưu trữ, tìm kiếm vector, hàng đợi, bộ đệm, lưu trữ đối tượng |
| Hạ tầng | Docker Compose, Prometheus, Grafana | Triển khai, khung giám sát |

Backend, extension, bot và AI nằm chung một kho Git; frontend là kho riêng. Quy mô hiện tại: core-service khoảng 29 nghìn dòng TypeScript trong 64 module, frontend khoảng 14,8 nghìn dòng với 29 trang, bot-worker khoảng 780 dòng, extension khoảng 700 dòng. Phần lớn module CRUD được sinh bằng công cụ `tools/generate-module.js` từ tệp đặc tả bảng, nên 43 bảng của thiết kế được hiện thực đồng nhất.

## Xây dựng dịch vụ lõi core-service

### Tổ chức mã nguồn và phân quyền

Core-service là nơi duy nhất sở hữu dữ liệu nghiệp vụ và quyết định quyền. Mỗi module theo khuôn cố định: thực thể, mô hình Sequelize, kho dữ liệu (repository), dịch vụ, bộ điều khiển và DTO kiểm tra đầu vào. `BaseService` và `SqlRepository` cung cấp sẵn thao tác CRUD, phân trang, xoá mềm; bộ điều khiển CRUD sinh từ `BaseControllerFactory`, mỗi module chỉ khai tuyến nào bật và cần quyền gì. Khung mẫu ban đầu có cả MongoDB; nhóm bỏ MongoDB, đưa toàn bộ dữ liệu về schema `core`. Thao tác nghiệp vụ nhiều bước (duyệt biên bản, duyệt đề xuất, mời bot) nằm ở các module riêng `workflow`, `meeting-processing`, `meeting-bot`, `me`.

Mô hình phân quyền vai trò kết hợp phạm vi [@sandhu1996; @hu2014] (xem [[fig-scope]]) được hiện thực trong `PermissionService`, với danh mục 54 quyền dạng `<tài nguyên>.<hành động>` và ba bảng ánh xạ vai trò → quyền cho workspace, dự án và cuộc họp độc lập. Hàm `resolve` tính tập quyền hiệu lực theo thứ tự: chỉ thành viên `active` mới có quyền; cộng quyền vai trò workspace; nếu yêu cầu gắn với cuộc họp thì xác nhận cuộc họp thuộc đúng workspace rồi suy ra dự án; cộng quyền vai trò dự án; với cuộc họp `restricted` thì cộng quyền theo bảng `meeting_access`. OWNER và ADMIN được coi như PM ở mọi dự án của workspace; SUPER_ADMIN không được đi vòng qua, vì đó là quyền quản trị nền tảng chứ không phải quyền đọc nội dung khách hàng. Hai điều kiện theo bản ghi được xét riêng: thành viên được sửa cuộc họp *do chính mình tạo* khi vẫn còn quyền xem nó (`canOnMeeting`), người được giao task được đổi trạng thái task đó (`canOnTask`).

`PermissionGuard` đọc quyền khai bằng `@RequirePermission` và xác định phạm vi từ header `x-workspace-id`, `x-project-id`, `x-meeting-id`, sau đó mới tới thân yêu cầu. Header là bắt buộc với yêu cầu multipart, vì multer phân tích thân yêu cầu *sau* khi guard chạy. Ban đầu guard xác thực và guard phân quyền gắn bằng hai decorator riêng; do decorator lớp áp dụng từ dưới lên, guard phân quyền đã chạy trước. Nhóm gộp cả hai vào decorator `Authorization()` để thứ tự luôn là xác thực JWT rồi mới phân quyền.

### Outbox, publisher và chống xử lý lặp

Giao tiếp giữa core-service với ai-worker, bot-worker và integration-service đi qua RabbitMQ [@rabbitmq] theo mẫu transactional outbox [@richardson2018] (xem [[fig-sequence]]). Mọi sự kiện có chung phong bì (`eventId`, `eventType`, `correlationId`, `payload`…); hợp đồng viết một lần trong `contracts/events.json`, có bản dịch cho TypeScript và Python. ai-worker nghe hàng đợi `ai.jobs`; bot-worker nghe `bot.jobs` cho lệnh vào phòng và `bot.control` cho lệnh dừng — tách riêng vì phiên ghi âm kéo dài hàng giờ, dùng chung thì lệnh dừng phải xếp sau chính phiên cần dừng; integration-service nghe `integration.jobs.task-sync`.

`OutboxService.emit` không gửi thẳng mà ghi một dòng `outbox_events` trạng thái `pending`. `OutboxPublisherService` quét mỗi 2 giây, lấy tối đa 50 sự kiện cũ nhất, phát với `messageId` bằng `eventId` ở chế độ lưu bền rồi đánh dấu `published`; lỗi được đếm, quá 5 lần thì chuyển `failed` để người vận hành kiểm tra. Nhờ vậy khi RabbitMQ ngừng, lệnh ghi nghiệp vụ vẫn thành công và sự kiện chờ trong bảng [@kleppmann2017]. Cần nói rõ hai hạn chế: `emit` nhận tham số `transaction` nhưng chưa nơi gọi nào truyền vào, nên job và sự kiện vẫn được ghi tuần tự, chưa cùng một giao dịch; hệ thống cũng chưa có hàng đợi thư chết (dead-letter queue) hay cơ chế tự chạy lại job lỗi. Đây là các việc cần hoàn thiện.

RabbitMQ chỉ bảo đảm giao tin ít nhất một lần (at-least-once), nên mọi consumer của Core phải chịu được tin lặp. `MessageDedupService.claim` ghi cặp `(messageId, consumer)` vào bảng `processed_messages` có chỉ mục duy nhất; lần thứ hai vi phạm ràng buộc và handler bỏ qua tin:

```typescript
@RabbitSubscribe({
    exchange: MEETINGMIND_EXCHANGE,
    routingKey: EventType.TRANSCRIPTION_COMPLETED,
    queue: `${CORE_EVENTS_QUEUE}.transcription-completed`,
    queueOptions: { durable: true },
})
async onTranscriptionCompleted(envelope: EventEnvelope<TranscriptionCompletedPayload>) {
    if (!(await this.dedup.claim(envelope.eventId, CONSUMER))) {
        return; // đã xử lý ở lần giao trước
    }
    await this.meetingProcessingService.onTranscriptionCompleted(envelope.payload);
}
```

Ở chiều phát lệnh, mỗi `processing_jobs` mang khoá lũy đẳng (`idempotencyKey`), ví dụ `<meetingId>:transcribe:<objectKey>`; gọi lại với cùng đầu vào trả về job đã có. Nguyên tắc này áp dụng nhất quán: mời bot khi đang có phiên hoạt động thì trả về phiên đó, duyệt lại một đề xuất đã duyệt không sinh thêm task, sự kiện trạng thái bot đến trễ không làm lùi phiên đã kết thúc.

### Điều phối luồng xử lý cuộc họp

`MeetingProcessingService` hiện thực luồng ở [[fig-pipeline]] theo nguyên tắc Core ra lệnh và ghi kết quả, AI chỉ tính toán rồi trả về. Khi nhận transcript, dịch vụ tạo `transcript_versions` mới (không ghi đè bản cũ), ghi từng đoạn kèm nhãn người nói, mốc thời gian, độ tin cậy, ngôn ngữ và cờ nói chồng, rồi cập nhật ngôn ngữ cuộc họp theo ngôn ngữ nói nhiều nhất. Lệnh phân tích gửi kèm toàn bộ transcript, vì ai-worker không được đọc schema `core`. Khi nhận kết quả phân tích, dịch vụ tạo biên bản nháp, một lô duyệt và các đề xuất chờ duyệt.

## Ba đường thu nhận nội dung cuộc họp

Hệ thống hỗ trợ ba cách đưa nội dung vào, ứng với ba bối cảnh: tải lên tệp ghi âm có sẵn (họp trực tiếp), mời bot ghi âm cuộc họp Google Meet (cách của Otter [@otter], Fireflies [@fireflies]), và extension đọc phụ đề do Meet sinh ra (cách của Tactiq [@tactiq]). Như [[fig-capture]] minh hoạ, hai đường đầu đi qua nhận dạng tiếng nói, đường thứ ba thì không; cả ba hội tụ tại `transcript_versions`, từ đó phần phân tích và duyệt dùng chung.

::figure fig-capture | Ba đường thu nhận nội dung cuộc họp hội tụ tại transcript_versions

### Tải tệp ghi âm lên MinIO

Bảng `files` chỉ lưu `bucket` và `objectKey`; khung mẫu cũ lưu tệp base64 trong cơ sở dữ liệu, không dùng được cho bản ghi một giờ. `MediaFileUploadService` kiểm tra kiểu MIME, tính băm SHA-256 và nếu workspace đã có tệp trùng băm thì dùng lại bản ghi cũ thay vì tạo object trùng. Tệp mới được đặt khoá `<workspaceId>/<meetingId>/<uuid>.<đuôi>`, chuyển trạng thái `uploading` → `ready` (hoặc `failed`). Để nghe lại, Core cấp URL ký có hạn 300 giây sau khi kiểm quyền `audio.listen`. Khi chạy thật, nhóm phát hiện chữ ký URL gắn chặt với tên máy: ký bằng tên nội bộ `minio` thì trình duyệt nhận lỗi 403; giải pháp là thêm `MINIO_PUBLIC_ENDPOINT` và một client riêng chỉ để ký. Với bot, Core chỉ đăng ký siêu dữ liệu của bản ghi bot tự đẩy lên MinIO, không làm trung gian cho tệp lớn.

### Bot tham gia và ghi âm Google Meet

Ở core-service, `MeetingBotService` kiểm tra quyền `meeting.recording.control` và đường dẫn đúng dạng `https://meet.google.com/...`, tạo `bot_sessions` rồi phát `bot.join.requested`; khi nhận `recording.completed`, Core đăng ký tệp và gọi đúng hàm bắt đầu phiên âm của đường tải tệp. Bot-worker mở hai kênh RabbitMQ: kênh việc nhận một phiên mỗi lúc (một hồ sơ Chromium không mở được hai lần) và kênh điều khiển để nhận lệnh dừng. Lệnh vào phòng được xác nhận (ack) ngay, vì phiên dài hơn `consumer_timeout` 30 phút sẽ bị broker đóng kênh.

::figure fig-bot-states | Trạng thái một phiên bot và các lý do kết thúc

Vòng đời một phiên ở [[fig-bot-states]]: `queued` khi Core tạo, `joining` khi mở trang, `waiting_admission` khi chờ chủ phòng duyệt, `recording` khi đã vào và bắt đầu ghi. Phiên kết thúc ở `left` khi chỉ còn một mình quá 60 giây, cuộc họp kết thúc, bị mời ra, có lệnh dừng hoặc vượt 4 giờ; thất bại ở `failed` khi Meet từ chối khách, chủ phòng từ chối hay chờ duyệt quá 300 giây; bị dừng khi còn `queued` thì thành `cancelled`. Tải lên không phải một trạng thái riêng: sau `left`, bản ghi dưới 4 KB (không ai nói) bị bỏ, còn lại được bot tải lên MinIO rồi phát `recording.completed`.

Bot dùng Playwright [@microsoft-playwright] điều khiển Chromium có giao diện trên màn hình ảo Xvfb, vì Meet hay từ chối trình duyệt không giao diện. Bot không bật micro, camera; âm thanh được ghi ngay trong trang bằng script chèn trước mọi script của Meet. Script bọc hàm tạo `RTCPeerConnection` [@w3c-webrtc] để bắt mọi track âm thanh từ xa, trộn vào một `AudioContext` rồi ghi bằng `MediaRecorder` dạng webm/opus 64 kbps, mỗi khúc 10 giây được đẩy về Python theo đúng thứ tự.

```javascript
const Original = window.RTCPeerConnection;
window.RTCPeerConnection = new Proxy(Original, {
    construct(target, args) {
        const pc = Reflect.construct(target, args);
        // Mỗi track âm thanh từ xa được trộn vào AudioContext chung.
        pc.addEventListener("track", (event) => attach(event.track));
        return pc;
    },
});
```

Phần tốn công nhất là các tình huống thực tế của Google Meet:

- **Google chặn khách ẩn danh dùng trình duyệt tự động** ("You can't join this video call"), nên bot bắt buộc dùng tài khoản Google riêng. Người vận hành đăng nhập một lần qua noVNC bằng `login.sh` (Chromium thường, vì trang đăng nhập Google cũng từ chối trình duyệt tự động); hồ sơ kèm cookie lưu ở volume `bot-profile`. Nếu hồ sơ bot trùng tài khoản với người trong phòng, Meet đề nghị "Switch here" — bấm vào sẽ đẩy người thật ra — nên bot nhận ra nút này và dừng với thông báo lỗi.
- **Giao diện Meet theo ngôn ngữ tài khoản**, không theo locale trình duyệt, nên với tài khoản tiếng Việt nút hiện "Yêu cầu tham gia". Nhóm ép giao diện tiếng Anh bằng tham số `hl=en` trên đường dẫn, giữ nhãn tiếng Việt làm dự phòng.
- **Nhãn nút dài, dễ khớp nhầm.** Nút thật tên "Ask to join without microphone & camera", còn so khớp lỏng "Join" lại trúng "Other ways to join"; nhóm chuyển sang so khớp tiền tố (`^Ask to join`).
- **Phòng chờ kiểu mới** cũng có nút "Leave call", nên bot chỉ coi là đã vào khi dòng "Asking to be let in" biến mất.
- **Thiếu thiết bị âm thanh.** Trong container không có loa, âm thanh WebRTC của người khác không chảy và bot chỉ ghi được khoảng lặng; nhóm khởi động PulseAudio với loa ảo (null sink). Ngoài ra, do một lỗi đã biết của Chromium, mỗi track từ xa phải gắn vào một thẻ `<audio>` tắt tiếng thì mới vào được Web Audio.
- **Hồ sơ trình duyệt của bot phải sạch.** Hồ sơ lưu phiên đăng nhập của bot không được kéo extension, tab hay lịch sử đồng bộ từ thiết bị khác, vì các thành phần lạ chèn vào trang có thể làm thay đổi giao diện Meet mà bot đang dò theo. Chromium của bot được chạy với `--disable-sync` cả khi đăng nhập lẫn khi vào phòng.
- **Hạ tầng:** `xvfb-run` treo khi là tiến trình số 1 nên Xvfb được khởi động trực tiếp; `/dev/shm` mặc định 64 MB làm tab sập nên container được cấp 1 GB.

Bot không vượt rào kiểm soát của Meet: hiện đúng tên, phải được chủ phòng duyệt và dừng ngay khi bị từ chối.

### Tiện ích mở rộng đọc phụ đề

Extension Chrome theo Manifest V3 [@google-mv3] không có bot và không ghi âm, chỉ đọc phụ đề Meet đã hiển thị trên màn hình của chính người dùng, nên có sẵn tên người nói. Người dùng bấm "Bắt đầu" trong popup; Core tìm cuộc họp theo đường dẫn phòng, chưa có thì tạo mới; khi kết thúc, Core chốt phiên bản transcript và gọi lại đúng bước phân tích của hai đường kia. Tên hiển thị trên Meet chỉ được lưu ở mức `suggested`, vì đó không phải bằng chứng danh tính.

`content.js` quét DOM mỗi 400 ms thay vì gắn `MutationObserver` cố định, vì Meet gỡ và dựng lại vùng phụ đề sau mỗi quãng im lặng. Vùng phụ đề được tìm theo thuộc tính trợ năng `[role="region"]` có `aria-label` chứa "Captions" hoặc "Phụ đề", không dựa vào tên lớp CSS bị làm rối; khối con có từ hai vùng chữ trở lên là một lượt nói, vùng đầu là tên. Thử trên phòng Meet thật ngày 29/10/2026 cho thấy ba lỗi. Thứ nhất là **lặp chồng**: Meet giữ một khối cho cùng người nói và nối câu mới vào sau, trong khi mã cũ gửi cả khối mỗi khi chữ đứng yên, nên transcript thành "A", "A B", "A B C". Mỗi khối giờ nhớ phần đã gửi và chỉ gửi phần mới, xử lý cả khi Meet cắt dòng đầu hay sửa từ đã gửi:

```javascript
function unsentPart(sent, live) {
    if (live.startsWith(sent)) return live.slice(sent.length).trim(); // nói tiếp
    const tail = sent.slice(-TAIL_LEN);                               // 24 ký tự cuối
    const at = tail.length === TAIL_LEN ? live.lastIndexOf(tail) : -1;
    if (at >= 0) return live.slice(at + TAIL_LEN).trim();             // Meet cắt dòng đầu
    // Meet sửa từ đã gửi: gửi lại từ đầu từ bị sửa, không gửi nửa từ.
    const p = commonPrefixLength(sent, live);
    const atBoundary = p === 0 || /\s/.test(live[p - 1]) || /\s/.test(live[p] ?? " ");
    const from = atBoundary ? p : live.lastIndexOf(" ", p) + 1;
    return live.slice(from).replace(/^[\s.,!?…]+/, "").trim();
}
```

Thứ hai là **bắt nhầm rác lúc im lặng**: khi vùng phụ đề rỗng, mã cũ rơi xuống bộ chọn dự phòng và đọc nhầm menu cài đặt thành phụ đề; các bộ chọn dự phòng đã bị bỏ. Thứ ba là **khai báo trùng biến**: các content script của cùng extension chung một phạm vi toàn cục, nên `unsentPart` khai ở cấp ngoài cùng của `caption-text.js` đụng `const { unsentPart }` trong `content.js`, làm `content.js` lỗi cú pháp và không chạy, trong khi popup chỉ báo "Không gọi được tab Meet". Nhóm bọc `caption-text.js` trong hàm tự gọi (IIFE) và viết kiểm thử nạp các content script theo thứ tự manifest vào chung một ngữ cảnh.

Service worker MV3 bị Chrome tắt sau khoảng 30 giây không có sự kiện, làm mất biến trong bộ nhớ và `setInterval`, nên phụ đề từng nằm mãi trong bộ đệm. Bộ đệm được chuyển vào `chrome.storage.local`, việc gửi theo lô 5 giây được hẹn bằng `setTimeout` mỗi khi có đoạn mới; gửi lỗi thì lô trả về bộ đệm, gặp mã 401 thì làm mới token rồi gửi lại. Hạn chế: người dùng phải bật phụ đề trong Meet và extension phụ thuộc cấu trúc DOM của Meet.

## Mô-đun nhận dạng tiếng nói

Mô-đun nhận dạng tiếng nói (Speech-to-Text, STT) dùng faster-whisper 1.2.1 [@systran-fw], bản cài đặt Whisper [@radford2023] trên CTranslate2 (xem [[fig-whisper]]), mặc định mô hình `small`, chạy CPU lượng tử hoá int8, beam search độ rộng 5; mô hình nạp một lần mỗi tiến trình. Phiên âm chạy trong luồng phụ (`asyncio.to_thread`), vì chặn vòng lặp sự kiện sẽ làm lỡ heartbeat và RabbitMQ cắt kết nối giữa chừng.

Whisper chỉ nhận diện ngôn ngữ một lần trên 30 giây đầu; cuộc họp nói lẫn Việt – Anh thì câu tiếng Anh bị giải mã như tiếng Việt thành chữ vô nghĩa hoặc bị dịch. Nhóm thiết kế phiên âm hai lượt ([[fig-stt-twopass]]). Lượt một chọn ngôn ngữ chính (xác suất dưới 0,5 thì theo ngôn ngữ cuộc họp do Core gửi) và phiên âm có lọc khoảng lặng (VAD). Lượt hai nhận diện lại ngôn ngữ trên từng đoạn từ 1,5 giây; nếu khác ngôn ngữ chính với xác suất từ 0,7 thì phiên âm lại đoạn đó bằng ngôn ngữ của nó và cộng bù mốc thời gian. Đoạn ngắn hơn giữ ngôn ngữ đoạn trước, vì người nói hiếm khi đổi thứ tiếng giữa một câu ngắn.

::figure fig-stt-twopass | Phiên âm hai lượt theo ngôn ngữ của từng đoạn

```python
DECODE = {"condition_on_previous_text": False, "word_timestamps": True,
          "hallucination_silence_threshold": 2.0}

def choose_segment_language(base, previous, duration_s, guess, settings):
    if duration_s < settings.min_detect_seconds or guess is None:
        return previous   # đoạn dưới 1,5 s: giữ ngôn ngữ đoạn trước
    language, probability = guess
    if probability >= settings.segment_min_prob:
        return language   # nhận diện lại đủ chắc (>= 0,7)
    return base           # không chắc: về ngôn ngữ chính
```

Tham số giải mã nhằm hạn chế "ảo giác" (sinh câu không có trong âm thanh) [@ji2023]: `condition_on_previous_text=False` tránh vòng lặp lặp câu; `hallucination_silence_threshold=2.0` bỏ đoạn bịa giữa khoảng lặng dài, cần `word_timestamps=True` — vốn cũng là đầu vào của bước tách người nói. Một biểu thức chính quy lọc thêm các câu Whisper hay bịa do học từ phụ đề video như "đăng ký kênh", "thanks for watching". Mỗi đoạn mang độ tin cậy và ngôn ngữ riêng; bản ghi kèm tỷ lệ thời lượng theo ngôn ngữ.

Hai lỗi phát sinh khi chạy thật đáng ghi lại. PyAV bản 19 bỏ tham số `metadata_errors` mà faster-whisper 1.2.1 vẫn truyền vào hàm mở tệp, khiến mọi lần giải mã lỗi; nhóm ghim `av==18.1.0`. Mốc thời gian của faster-whisper là số kiểu NumPy, nên cờ nói chồng tính từ chúng có kiểu `numpy.bool` không chuyển được sang JSON, kết quả không gửi về được và job ở Core kẹt ở trạng thái chờ; nhóm thêm hàm chuyển kiểu khi tuần tự hoá và đưa lệnh gửi vào khối bắt lỗi để mọi lỗi đều thành `transcription.failed`. Độ chính xác được đánh giá ở chương Thực nghiệm và đánh giá ([[fig-wer]]).

## Mô-đun tách người nói

Với cuộc họp trực tiếp ghi bằng một micro, mô-đun tách người nói (speaker diarization) [@park2022] trả lời câu hỏi "ai nói khi nào". Nhóm thử trước mô hình phân đoạn pyannote [@bredin2020], nhưng trên dữ liệu thử mô hình coi cả cửa sổ 10 giây là một người và gộp nhầm lời hai người, trong khi vector đặc trưng giọng tách người rất rõ (độ giống cosine khoảng 0,6 giữa hai khúc cùng người, khoảng 0,2 giữa hai người khác nhau). Vì vậy nhóm chuyển sang gom cụm trực tiếp các khúc lời ([[fig-diarization]]).

::figure fig-diarization | Quy trình tách người nói bằng gom cụm vector đặc trưng giọng

Lời Whisper được cắt thành khúc khoảng 1,5 giây theo mốc từ, cắt thêm khi gặp khoảng lặng trên 0,4 giây hoặc sang đoạn Whisper mới. Mỗi khúc được tính vector đặc trưng giọng bằng mô hình ERes2Net của bộ 3D-Speaker [@chen2023eres2net] qua sherpa-onnx [@k2fsa-sherpa] trên CPU — ý tưởng biểu diễn người nói bằng vector nhúng cố định độ dài kế thừa từ x-vector [@snyder2018]. Các vector được gom cụm phân cấp theo liên kết trung bình (average linkage): liên tục ghép hai cụm có độ tương đồng cosine cao nhất, chừng nào độ tương đồng đó còn từ 0,3 trở lên, nên số người được suy ra chứ không khai trước. Thu âm ồn hay sinh "người nói" ảo chỉ vài giây, nên cụm có tổng thời gian nói dưới 2 giây được gộp vào cụm lớn giống nhất; đánh đổi là người chỉ nói một câu "ok" có thể bị gộp vào người khác.

Để đánh dấu nói chồng, mô-đun xét độ giống của mỗi khúc với tâm cụm *đứng thứ hai*: khi hai người nói chồng, giọng át vẫn trội nhưng độ giống với người kia nhích lên. Mức "bình thường" khác nhau theo bản ghi, nên ngưỡng được tính thích nghi bằng trung vị cộng hai lần độ lệch tuyệt đối trung vị (MAD), với sàn 0,3. Từ các khúc đã gán người, mô-đun ghép ngược với lời Whisper: mỗi từ thuộc lượt nói phủ nó nhiều nhất, một đoạn Whisper trùm hai người được cắt đôi đúng chỗ đổi người, nhãn "Người nói 1, 2…" đặt theo thứ tự lên tiếng, và đoạn có phần chồng lấn từ 0,3 giây (hoặc từ 30% thời lượng) được gắn cờ `isOverlapping`. Sau khi thực nghiệm cho thấy cơ chế này báo nhầm nhiều (chương Thực nghiệm và đánh giá), cờ được tắt mặc định và chỉ bật khi đặt biến `AI_DIARIZATION_OVERLAP=1` để nghiên cứu tiếp.

Tách người nói là phần bổ sung, không được làm hỏng phiên âm: toàn bộ bước này nằm trong khối bắt lỗi, lỗi chỉ được ghi log và mọi đoạn nhận chung nhãn "Người nói 1"; biến `AI_DIARIZATION=0` tắt hẳn. Giới hạn bản chất là với một micro, lời người nói chồng thường bị Whisper bỏ mất, nên cờ nói chồng chỉ là gợi ý "nên nghe lại"; nhãn "Người nói N" cũng không phải danh tính, người dùng gán tên ở màn hình transcript.

## Mô-đun phân tích biên bản bằng LLM

Mô-đun phân tích nhận transcript và trả về tóm tắt, quyết định, vấn đề còn mở và công việc, mỗi mục kèm câu trích và số dòng làm bằng chứng ([[fig-llm-extract]]). Worker gọi dịch vụ Serverless Inference của FPT AI Factory [@fpt-aifactory] qua API kiểu OpenAI tại `https://token-api.fpt.ai/v1`, nhiệt độ 0,2, tối đa 32.000 token đầu ra vì mô hình có bước suy luận tiêu tốn nhiều token. Nhóm không bật `response_format` JSON vì khi bật, mô hình chính trả nội dung rỗng; prompt yêu cầu JSON và worker tự bóc tách, kể cả khi mô hình bọc kết quả trong khối mã hay nói thêm.

::figure fig-llm-extract | Trích xuất biên bản có cấu trúc bằng LLM và đối chiếu bằng chứng

Transcript được đưa vào dạng các dòng `[số thứ tự] Người nói: lời nói`. Lời nhắc hệ thống, dựa trên khả năng làm theo chỉ dẫn của LLM [@brown2020], quy định viết biên bản bằng ngôn ngữ chính của cuộc họp và nêu các quy tắc rút từ tình huống thật: đề xuất chưa ai đồng ý ("hay là…") không phải quyết định; người thực hiện ghi đúng tên trong transcript; thời hạn giữ nguyên văn ("thứ Sáu"), không tự đoán ngày; có đính chính thì lấy thông tin cuối; bỏ chuyện ngoài lề; không bịa thông tin [@ji2023]; câu trích phải nguyên văn từ đúng dòng được dẫn.

Mô hình được chọn bằng chấm thử có đáp án trên một cuộc họp tiếng Việt mẫu chứa đủ hiện tượng khó (đề xuất khác quyết định, hạn bị đính chính, đổi người làm giữa chừng, chuyện ngoài lề, câu tiếng Anh xen kẽ, người nói chỉ có nhãn tự động); mỗi mô hình ứng viên chạy nhiều lần, chấm theo đáp án và đo thời gian. Chỉ xét mô hình do FPT tự vận hành để dữ liệu hội thoại không ra ngoài hạ tầng FPT. Kết quả, DeepSeek-V4.1-Flash (họ DeepSeek [@deepseek2024]) được chọn làm mô hình chính vì chính xác nhất dù chậm hơn, GLM-5.2 (họ GLM [@glm2024]) nhanh hơn nhiều làm dự phòng; số liệu ở chương Thực nghiệm và đánh giá ([[fig-llm-models]]).

Lời gọi LLM dùng chế độ truyền luồng (stream): khi gọi thường, cổng dịch vụ trả lỗi hết thời gian chờ (HTTP 524) nếu mô hình suy luận quá lâu, còn ở chế độ luồng các token suy luận chảy về liên tục nên kết nối không bị cắt; phần suy luận bị bỏ qua, chỉ ghép phần nội dung, và tổng thời gian vẫn bị giới hạn. Worker thử mô hình chính rồi mô hình dự phòng; một mô hình bị coi là không dùng được khi lỗi HTTP, trả nội dung rỗng, hết token trước khi xong JSON hoặc JSON hỏng; cả hai lỗi thì phát `analysis.failed` kèm lỗi của cả hai. Kết quả được chuẩn hoá: bỏ mục không tiêu đề, quy "null", "N/A" về rỗng, `priority` ngoài {high, medium, low} quy về medium, `confidence` cắt vào [0, 1]. Số dòng bằng chứng được đối chiếu lại với câu trích, vì mô hình đôi khi trích đúng câu nhưng ghi lệch dòng:

```python
def ground(quote, sequence, texts):
    needle = _norm(quote).strip(" .,\"'“”…") if quote else ""
    if needle:
        if sequence in texts and needle in _norm(texts[sequence]):
            return sequence                 # số dòng model đưa là đúng
        for seq, text in texts.items():     # dò lại theo nội dung câu trích
            if needle in _norm(text):
                return seq
    return sequence if sequence in texts else None
```

Khi transcript rỗng, worker không gọi LLM mà trả kết quả rỗng, tránh để mô hình bịa biên bản. Cấu hình đọc từ biến môi trường; khoá API đặt trong tệp `.env` đã đưa vào `.gitignore`, thiếu khoá thì worker tự lùi về bộ phân tích giả lập. Tên người thực hiện (`assigneeHint`) chỉ là tên trong transcript; Core không tự ánh xạ sang tài khoản mà để người duyệt chọn.

## Luồng duyệt và quản lý công việc

Kết quả AI không trở thành dữ liệu chính thức nếu chưa có người duyệt. Biên bản quản lý theo phiên bản với ba trạng thái `draft` → `pending_approval` → `approved`; người có quyền `minutes.approve` duyệt hoặc trả về nháp. Biên bản đã duyệt không sửa trực tiếp: thao tác "tạo nháp mới" sinh phiên bản kế tiếp chép nội dung bản đã duyệt, bản cũ giữ nguyên; chạy lại AI cũng chỉ tạo nháp mới.

Đề xuất của AI nằm trong `review_items` với ba loại: công việc, quyết định, vấn đề còn mở; mỗi mục giữ song song bản AI sinh và bản người dùng sửa. Duyệt một đề xuất công việc sinh đúng một `action_items` nguồn `ai`, ghi người duyệt, độ tin cậy, mức ưu tiên, người thực hiện do người duyệt chọn; nếu chỉ có câu gốc như "thứ Sáu" mà chưa chốt ngày thì task được đánh dấu cần xác nhận hạn. Duyệt đề xuất quyết định sinh một `decisions`. Nguồn gốc của task được truy qua đề xuất đã sinh ra nó: câu trích và số dòng nằm trong nội dung đề xuất, lô duyệt giữ định danh phiên bản transcript nguồn; bảng `action_item_citations` đã có nhưng thao tác duyệt chưa ghi vào — phần này đang hoàn thiện. Sau khi duyệt, PM/Admin hoặc người được giao đổi được trạng thái task, còn giao người, đổi hạn, đổi ưu tiên chỉ người có quyền `task.assign` làm được; dịch vụ chỉ coi là "lên kế hoạch" khi giá trị thật sự khác giá trị đang lưu, vì giao diện gửi lại cả trường không đổi.

Gán tên người nói (speaker alias) là thao tác có chủ đích của người dùng. Khi gắn nhãn "Người nói 2" với một thành viên, các đoạn transcript chuyển sang danh tính `confirmed` và `speaker_aliases` ghi người xác nhận. Thao tác này **không** tự đổi người được giao của task đã duyệt; thay vào đó, task của cuộc họp được đánh dấu `needsReviewReason = speaker_changed` để PM rà soát.

Vì phân tích AI chạy ngay khi có transcript, tức là trước khi người dùng kịp gán tên, hệ thống cung cấp thao tác **phân tích lại** (`POST /workflow/meetings/:id/reanalyze`, nút "Phân tích lại" trong khung người nói). Khi gán tên, bí danh lưu tên hiển thị của thành viên; khi phân tích lại, transcript gửi sang AI mang tên thật thay cho nhãn "Người nói N", nhờ đó người thực hiện trong đề xuất mới là tên thành viên. Mỗi lần phân tích lại là một job mới với khoá chống lặp riêng, sinh biên bản nháp và lô đề xuất mới; biên bản, công việc đã duyệt giữ nguyên.

## Mô-đun đồng bộ Trello và cảnh báo Telegram

Mô-đun này hiện thực phần đồng bộ trong thiết kế ở chương Phân tích và thiết kế: đưa công việc *đã được duyệt* sang bảng Trello [@atlassian-trello] của nhóm và báo tin qua Telegram [@telegram-bot]. Mô-đun nằm trong integration-service — dịch vụ NestJS trước đó chỉ là khung — dưới tên `task-sync`, và được làm ở mức MVP: mỗi nhà cung cấp một kết nối cấu hình qua biến môi trường, đồng bộ một chiều (chỉ tạo thẻ, chưa cập nhật trạng thái ngược lại); đồng bộ Jira chưa được hiện thực.

**Luồng xử lý.** Khi người duyệt chấp nhận một đề xuất công việc, cùng với việc tạo `action_items`, Core ghi sự kiện `task.sync.requested` vào outbox. Vì integration-service không được đọc schema `core`, thông điệp mang ảnh chụp công việc tại lúc duyệt: tiêu đề, mô tả, tên người thực hiện, hạn dạng ISO 8601 và câu hạn gốc, mức ưu tiên, tên cuộc họp, câu trích nguồn, cùng khoá `<actionItemId>:push`. Bộ phát outbox đẩy sự kiện lên exchange topic `meetingmind`; integration-service, nay đã bật kết nối RabbitMQ, nhận nó qua hàng đợi bền `integration.jobs.task-sync` rồi xử lý lần lượt Trello và Telegram. Sau khi ghi kết quả vào cơ sở dữ liệu, dịch vụ phát `task.sync.completed` gồm `actionItemId` và kết quả của từng nhà cung cấp (trạng thái `synced`, `failed` hoặc `skipped`, mã và đường dẫn đối tượng ngoài, thông báo lỗi). Core lưu danh sách này vào trường `externalLinks` của công việc; ngăn chi tiết công việc trên giao diện có thêm dòng "Đồng bộ" với liên kết "Trello" dẫn tới thẻ, nhãn "Đã báo Telegram" hoặc lỗi của từng bên ([[fig-ui-sync]]).

::figure fig-ui-sync | Ngăn chi tiết công việc hiển thị kết quả đồng bộ Trello và Telegram | 15

**Hành vi theo nhà cung cấp** được tóm tắt ở [[tb-sync]]. Danh sách "Việc từ cuộc họp" được dịch vụ tự tìm hoặc tạo trên bảng Trello đã cấu hình, mã danh sách được lưu lại cho các lần sau. Thẻ mang tiêu đề công việc và trường hạn nếu ngày đã chốt; mô tả thẻ ghi người thực hiện, hạn hoặc câu hạn gốc, ưu tiên, tên cuộc họp, câu trích nguồn và kết thúc bằng dòng đánh dấu `MeetingMind #<actionItemId>`. Tin Telegram "Công việc mới từ cuộc họp" được gửi qua một bot riêng của MeetingMind và kèm đường dẫn thẻ Trello nếu bước trước thành công — vì vậy Telegram chạy sau Trello. Phương thức `getUpdates` chỉ được dùng để dò cuộc trò chuyện đã nhắn cho bot khi chưa cấu hình mã cuộc trò chuyện.

::table tb-sync | Hành vi của mô-đun đồng bộ theo từng nhà cung cấp
| Tiêu chí | Trello | Telegram |
|---|---|---|
| Thao tác | Tạo thẻ trong danh sách "Việc từ cuộc họp" (tự tìm hoặc tạo trên bảng cấu hình) | Gửi tin `sendMessage` (HTML) qua bot riêng của MeetingMind |
| Nội dung | Tiêu đề, người thực hiện, hạn hoặc câu hạn gốc, ưu tiên, cuộc họp, câu trích, dòng đánh dấu | Tiêu đề, người thực hiện, hạn, ưu tiên, cuộc họp, đường dẫn thẻ Trello |
| Chống trùng | Job theo khoá; tra `external_task_links`; dò thẻ mang dòng đánh dấu trước khi tạo | Job theo khoá; không tra cứu được tin đã gửi |
| Nơi lưu kết quả | `external_task_links` (externalId, externalUrl, syncStatus) | `sync_jobs` (mã tin nhắn) |
| Thiếu khoá cấu hình | `skipped`, không gọi API | `skipped`, không gọi API |

**Chống tạo trùng.** Tài liệu thiết kế cơ sở dữ liệu đã cảnh báo rằng chống lặp thông điệp nội bộ chưa đủ cho lời gọi ra hệ thống ngoài, nên mô-đun xử lý ở ba lớp. Ở lớp thông điệp, consumer ghi cặp (eventId, tên consumer) vào `processed_messages` trước mọi thao tác khác; chỉ lỗi vi phạm khoá duy nhất mới được coi là "đã xử lý", lỗi cơ sở dữ liệu khác được ném ra để tin được giao lại — bộ chống lặp của Core trước đó nuốt mọi lỗi và có thể làm mất tin, nên được sửa cùng lúc. Ở lớp job, mỗi nhà cung cấp có một bản ghi `sync_jobs` với khoá duy nhất `<actionItemId>:push:<provider>`; job đã thành công thì kết quả cũ được dùng lại, không gọi API lần nữa. Ở lớp nền tảng ngoài, Trello không hỗ trợ khoá idempotency nên lời gọi tạo thẻ có thể đã thành công nhưng mất phản hồi; vì vậy, trước khi tạo, dịch vụ tra `external_task_links` rồi dò trong danh sách đích thẻ mang dòng đánh dấu của công việc và dùng lại nếu tìm thấy:

```typescript
const idempotencyKey = `${payload.idempotencyKey}:${provider}`; // <id>:push:trello
const job = await this.syncJobService.getOne(null, { idempotencyKey });
if (job?.status === SyncJobStatus.SUCCEEDED) return job.result; // không gọi API lại
// ...
// Trello không có khoá idempotency: dò dòng đánh dấu trước khi tạo thẻ mới.
const marker = trelloMarker(payload.actionItemId);             // "MeetingMind #<id>"
let card = await this.trello.findCardByMarker(listId, marker);
if (!card) {
    card = await this.trello.createCard({ listId, name: payload.task.title,
        desc: buildTrelloDescription(payload), due });
}
```

Telegram không có cơ chế tương tự: Bot API không cho tra cứu tin đã gửi, nên nếu `sendMessage` thành công nhưng mất phản hồi, lần thử lại có thể gửi trùng một tin. Nhóm chấp nhận giới hạn này vì một tin báo trùng ít hại hơn một thẻ công việc trùng.

**Xử lý lỗi.** Mỗi nhà cung cấp chạy độc lập: lỗi API hay cấu hình sai của Trello chỉ làm kết quả Trello là `failed`, tin Telegram vẫn được gửi (không kèm đường dẫn thẻ), và ngược lại. Thiếu khoá cấu hình thì nhà cung cấp đó nhận trạng thái `skipped` chứ không bị coi là lỗi, nên hệ thống vẫn chạy khi chưa kết nối công cụ nào. Với lỗi hạ tầng (cơ sở dữ liệu, RabbitMQ), consumer trả lại bản ghi chống lặp, chờ một nhịp rồi để tin quay lại hàng đợi. Sự kiện `task.sync.completed` được phát thẳng sau khi ghi cơ sở dữ liệu, không qua outbox; điều này chấp nhận được vì Core xử lý lũy đẳng theo `actionItemId` (ghi đè danh sách liên kết), còn nếu phát lỗi thì tin gốc được giao lại và các job đã thành công chỉ phát lại kết quả cũ. Hệ thống chưa có hàng đợi thư chết cho các lần đồng bộ lỗi.

**Bảo mật khoá.** Khoá API và token Trello, token bot Telegram chỉ được đọc từ biến môi trường (tệp `.env` đã nằm trong `.gitignore`), không ghi vào cơ sở dữ liệu; bảng `integrations` chỉ giữ thông tin không bí mật. Vì khoá Trello nằm trên chuỗi truy vấn còn token Telegram nằm ngay trên đường dẫn URL, mọi thông báo lỗi đều đi qua một hàm xoá bí mật trước khi ghi log, ghi cơ sở dữ liệu hay gửi về Core; nhóm đã kiểm tra log và thông báo lỗi không chứa khoá.

**Lỗi khung mẫu.** Khi bật RabbitMQ cho integration-service, nhóm gặp một lỗi kế thừa từ khung mẫu: các interceptor và bộ lọc ngoại lệ HTTP được gắn toàn cục nên cũng chạy với handler RabbitMQ, vốn không có đối tượng yêu cầu và phản hồi HTTP; handler bị sập và tin bị trả lại hàng đợi khoảng 1.500 lần mỗi giây. Các thành phần này được sửa để bỏ qua ngữ cảnh không phải HTTP.

**Kết quả kiểm thử.** Mô-đun có 20 ca kiểm thử đơn vị Jest, tổng hợp ở mục Kiểm thử phần mềm. Trong kiểm thử đầu-cuối trên Docker Compose với tài khoản Trello và bot Telegram thật, duyệt công việc "Viết tài liệu API bằng Swagger" thì sau 3,4 giây thẻ được tạo trên bảng "MeetingMind", trong danh sách "Việc từ cuộc họp" do hệ thống tự tạo; tin Telegram kèm đường dẫn thẻ được gửi; Core lưu cả hai kết quả và giao diện hiển thị như [[fig-ui-sync]]. Một lần duyệt trước đó, khi chưa cấu hình khoá Trello, cho kết quả Trello `skipped` và tin Telegram đến sau khoảng 2 giây, đúng thiết kế bỏ qua nhà cung cấp thiếu cấu hình.

## Mô-đun hỏi đáp tri thức cuộc họp (RAG)

Mô-đun này cho phép người dùng hỏi bằng ngôn ngữ tự nhiên trên tri thức của các cuộc họp trong workspace, chẳng hạn "nhóm chốt dùng cơ sở dữ liệu gì?", và nhận câu trả lời kèm trích dẫn tới đúng đoạn nguồn. Mô-đun hiện thực các yêu cầu thiết kế cho hỏi đáp ở chương Phân tích và thiết kế theo hướng sinh văn bản tăng cường truy xuất: chỉ trả lời từ nguồn, thiếu nguồn thì nói rõ, lọc quyền trước khi truy xuất. Việc được chia cho ba thành phần: core-service quyết định nội dung nào được lập chỉ mục và người hỏi được tìm trong cuộc họp nào; ai-worker chia đoạn, nhúng vector và lưu vào schema `ai`; ai-service (FastAPI) tìm kiếm, xếp hạng lại và gọi LLM. [[tb-rag]] tóm tắt các tham số chính.

### Lập chỉ mục tri thức

Vì dịch vụ AI không được đọc schema `core`, Core gửi kèm nội dung cần lập chỉ mục trong sự kiện `knowledge.index.requested` (qua outbox và RabbitMQ) khi: có phiên bản transcript mới, kể cả khi người dùng gán tên người nói — transcript được gửi lại với tên thật; biên bản được duyệt (tóm tắt và vấn đề còn mở); quyết định hoặc công việc được duyệt, hay công việc được sửa người thực hiện, thời hạn; có tài liệu tải lên cuộc họp. Tài liệu nhận PDF, DOCX, TXT, Markdown tối đa 20 MB; thông điệp chỉ mang khoá object, ai-worker tự tải từ MinIO và tách chữ bằng pypdf hoặc python-docx. Xoá tài liệu phát `knowledge.delete.requested`. Owner hoặc Admin có thể gọi `POST /workflow/knowledge/reindex` để lập chỉ mục lại toàn bộ workspace.

ai-worker chia đoạn theo loại nguồn. Transcript được gom các lượt nói liên tiếp thành đoạn khoảng 500–900 ký tự, không cắt ngang lượt nói, mỗi dòng dạng `[mm:ss] Người nói: lời nói`, nên trích dẫn luôn trỏ về một lượt nói có người nói và mốc thời gian. Biên bản, quyết định, công việc thì mỗi mục một đoạn; tài liệu được cắt theo đoạn văn, khoảng 900 ký tự, chồng nhau khoảng 100 ký tự. Mỗi đoạn được thêm đầu mục gồm tên cuộc họp và loại nguồn trước khi nhúng, vì câu hỏi hay nhắc tên cuộc họp còn lời nói thì không.

Véc-tơ được tính bằng Vietnamese_Embedding (1024 chiều) trên FPT AI Factory [@fpt-aifactory], cùng hạ tầng với LLM. Mô hình này được chọn sau khi thử: nó tách rõ câu liên quan (độ tương đồng 0,38) khỏi câu không liên quan (0,09–0,16), còn multilingual-e5-large cho điểm dồn sát nhau trong khoảng 0,74–0,83. Đoạn và vector lưu ở bảng `ai.document_chunks` (pgvector 0.8.6, chỉ mục HNSW theo khoảng cách cosine). Lời gọi nhúng hoàn tất trước khi mở giao dịch; trong một giao dịch, bản mới thay toàn bộ đoạn cũ cùng nguồn, với transcript và biên bản thì xoá cả đoạn của phiên bản cũ cùng cuộc họp. Nhờ vậy xử lý lặp một thông điệp là vô hại và lỗi nhúng không làm mất bản cũ.

### Truy xuất và trả lời có trích dẫn

Khi người dùng hỏi, Core kiểm tra quyền `chat.query` trên workspace rồi tính tập cuộc họp người hỏi được xem bằng *cùng một hàm* với danh sách cuộc họp, `PermissionService.filterMeetings`, yêu cầu quyền xem cuộc họp, transcript và biên bản đã duyệt. Tập rỗng thì Core trả ngay "chưa đủ thông tin", không gọi mô hình. Ngược lại, Core gọi `POST /internal/knowledge/ask` của ai-service kèm danh sách đó; route chỉ nhận yêu cầu có khoá nội bộ `X-Internal-Token`, so sánh bằng hàm thời gian hằng, và trả mã 503 khi khoá chưa được cấu hình.

ai-service nhúng câu hỏi (câu hỏi nối tiếp được ghép với câu hỏi trước để tìm đúng chủ đề) rồi tìm 24 đoạn gần nhất chỉ trong các cuộc họp được phép:

```sql
SELECT id, meeting_id, source_type, content, start_ms, metadata,
       embedding <=> %(vector)s::vector AS distance
FROM ai.document_chunks
WHERE workspace_id = %(workspace_id)s
  AND meeting_id = ANY(%(meeting_ids)s::text[])   -- lọc quyền trước khi đọc
  AND index_status = 'indexed'
ORDER BY embedding <=> %(vector)s::vector
LIMIT 24
```

Điều kiện quyền nằm trong mệnh đề `WHERE` nên đoạn của cuộc họp ngoài quyền không bao giờ được đọc ra, càng không tới mô hình; chế độ quét lặp của pgvector được bật để bộ lọc không làm hụt kết quả khi dùng chỉ mục HNSW. Các ứng viên được xếp hạng lại bằng cross-encoder bge-reranker-v2-m3 (FPT AI Factory), khi thử cho đoạn liên quan khoảng 0,98 điểm và đoạn không liên quan khoảng 0,00002; hệ thống giữ tối đa 6 đoạn đạt ngưỡng 0,02, ngưỡng thấp để không bỏ sót đoạn diễn đạt khác câu hỏi. Reranker lỗi thì giữ thứ tự vector.

Các đoạn được đánh số [1]…[6] trong prompt kèm tên cuộc họp, loại nguồn, mốc thời gian. Lời nhắc hệ thống buộc mô hình chỉ dùng thông tin trong nguồn, không bịa tên, ngày, con số; mỗi câu nêu thông tin phải có [n]; phân biệt điều đã chốt với đề xuất; có đính chính thì nêu thông tin sau cùng; nguồn không chứa câu trả lời thì trả đúng câu "Chưa đủ thông tin trong các cuộc họp bạn được xem để trả lời câu hỏi này." [@ji2023]. Mô hình trả lời là GLM-5.2 [@glm2024] vì phản hồi nhanh, phù hợp người đang chờ; DeepSeek-V4.1-Flash, chậm hơn do có bước suy luận, làm dự phòng; cả hai gọi theo luồng. Vì mô hình đôi khi đánh số lộn xộn hoặc dẫn nguồn không tồn tại, ai-service tự đánh lại trích dẫn thành 1…k theo thứ tự xuất hiện, bỏ số ngoài phạm vi và tự chọn câu trích từ chính đoạn nguồn.

### Lọc quyền hai lớp và kiểm tra lại trích dẫn

Lớp thứ nhất ở Core: phạm vi tìm kiếm dùng đúng luật của danh sách cuộc họp, nên không có luật quyền thứ hai phải giữ đồng bộ. Lớp thứ hai ở cơ sở dữ liệu: phạm vi ấy được áp trong câu SQL trước khi lấy bất kỳ nội dung nào. Sau cùng, Core kiểm tra lại từng trích dẫn; chỉ cần một trích dẫn trỏ ra ngoài tập cuộc họp được xem, Core bỏ cả câu trả lời, vì khi ấy chính câu trả lời có thể đã dùng nội dung không được phép. Trích dẫn hợp lệ được gắn tiêu đề và ngày họp hiện hành từ dữ liệu của Core. Khác thiết kế ban đầu, chỉ mục không lưu cột quyền (`visibility`, `allowedUserIds`) mà dựa vào danh sách cuộc họp Core gửi kèm mỗi câu hỏi, nên quyền dùng để lọc luôn là quyền hiện hành.

### Giao diện Tri thức

::figure fig-ui-knowledge | Trang Tri thức: notebook nguồn và hỏi đáp có trích dẫn | 15

Trang Tri thức ([[fig-ui-knowledge]]) có khung Notebook liệt kê các nguồn đã lập chỉ mục mà người dùng được xem (Transcript, Biên bản, Quyết định, Công việc, Tài liệu), lọc theo loại nguồn và dự án, và khung Hỏi đáp AI hiển thị câu trả lời, danh sách mục khi có nhiều ý, cùng các thẻ trích dẫn "[n] tên cuộc họp · mm:ss · loại nguồn" dẫn tới đúng tab chứa nguồn trong trang cuộc họp. Tài liệu được tải lên hoặc xoá ở trang Tri thức hoặc tab Thông tin của cuộc họp.

::table tb-rag | Thành phần và tham số của mô-đun hỏi đáp tri thức
| Khâu | Lựa chọn trong MeetingMind | Ghi chú |
|---|---|---|
| Nguồn tri thức | Transcript, biên bản đã duyệt, quyết định, công việc, tài liệu (PDF, DOCX, TXT, MD, tối đa 20 MB) | Core gửi qua `knowledge.index.requested` |
| Chia đoạn | Transcript: gom lượt nói, ~500–900 ký tự; mỗi mục biên bản, quyết định, công việc một đoạn; tài liệu ~900 ký tự, chồng ~100 | Không cắt ngang lượt nói |
| Mô hình nhúng | Vietnamese_Embedding (FPT AI Factory), 1024 chiều | Đã thử multilingual-e5-large, kém phân biệt hơn |
| Lưu trữ, chỉ mục | `ai.document_chunks`, pgvector 0.8.6, HNSW cosine | Bản mới thay bản cũ trong một giao dịch |
| Truy xuất | 24 đoạn gần nhất, lọc `workspace_id` và `meeting_id = ANY(…)` trong SQL | Quét lặp HNSW để không hụt kết quả |
| Xếp hạng lại | bge-reranker-v2-m3; giữ tối đa 6 đoạn, ngưỡng 0,02 | Lỗi thì giữ thứ tự vector |
| Mô hình trả lời | GLM-5.2, dự phòng DeepSeek-V4.1-Flash; gọi theo luồng | Bắt buộc [n]; thiếu nguồn trả "chưa đủ thông tin" |
| Bảo vệ API nội bộ | `X-Internal-Token`, so sánh thời gian hằng | Chưa cấu hình khoá thì trả 503 |

**Kết quả kiểm thử.** Mô-đun có 37 ca kiểm thử đơn vị pytest. Đánh giá qua API của Core ở chương Thực nghiệm và đánh giá cho kết quả 10/10 câu hỏi đạt, mỗi câu 1,2–1,8 giây; người ngoài workspace bị từ chối, thành viên không được xem cuộc họp nào chỉ nhận câu trả lời "chưa đủ thông tin"; bộ chấm mở rộng 27 câu trên ba cuộc họp với hai người dùng có quyền khác nhau đạt 27/27, không rò rỉ.

**Lịch sử hội thoại phía máy chủ.** Mỗi câu hỏi thuộc một hội thoại lưu ở `ai.chat_threads`/`ai.chat_messages` theo từng người dùng (hệ thống phục vụ một tổ chức nên lưu tập trung là phù hợp). Ngữ cảnh lượt trước được đọc từ cơ sở dữ liệu, không nhận từ trình duyệt, để người dùng không thể chèn "lịch sử giả" dẫn dắt mô hình. Với câu hỏi nối tiếp có đại từ ("hạn của người đó?"), một lời gọi mô hình nhanh viết lại câu hỏi thành câu đầy đủ trước khi tìm kiếm, vì tên người cần tìm thường chỉ nằm trong câu trả lời trước. Khi người dùng mở lại hội thoại cũ, Core kiểm tra lại quyền: câu trả lời trích từ cuộc họp người dùng không còn được xem được thay bằng thông báo và bỏ trích dẫn. Giao diện có danh sách hội thoại, tạo mới, đổi tên, xoá.

**Tài liệu quét và ảnh.** Trang PDF có quá ít chữ (dưới khoảng 40 ký tự) được chuyển thành ảnh và nhận dạng ký tự quang học bằng Tesseract với gói tiếng Việt, chạy ngay trên máy chủ nên tài liệu không rời hệ thống; tài liệu dạng ảnh (png, jpg, webp) cũng được nhận dạng. Thử trên một trang biên bản quét có nhiễu và hơi nghiêng, kết quả chỉ sai một dấu ("va" thay cho "và"); ảnh chụp rõ nét khớp toàn bộ.

**Độ bền của chỉ mục.** Xoá cuộc họp phát `knowledge.delete.requested` để xoá các đoạn tương ứng. Core tự khai báo hàng đợi và liên kết của các bên nhận mỗi khi kết nối RabbitMQ, nên sự kiện lập chỉ mục không bị rơi khi ai-worker chưa chạy. Câu trích dẫn được chọn ưu tiên câu chứa đúng con số trong câu trả lời và gộp câu bị đính chính với câu đính chính ("ngày 15… À không, ngày 18"), để người đọc không bị dẫn tới câu đã bị sửa.

## Giao diện web

Giao diện xây dựng bằng Next.js 16 (App Router), React 19, Tailwind CSS 4 và shadcn/Radix UI. Trình duyệt chỉ gọi `/api/...` cùng nguồn gốc, Next.js chuyển tiếp thẳng tới core-service (cổng 3010) nên không phải cấu hình CORS; cũng như extension, giao diện hiện chưa đi qua api-gateway. Giao diện được thiết kế trước dưới dạng bản mẫu, sau đó mới nối backend qua một lớp chuyển đổi: `live.ts` gom mọi lời gọi API, `adapters.ts` chuyển dữ liệu backend sang kiểu giao diện, nên các thành phần không phải viết lại. Có phiên đăng nhập thì chạy chế độ *live*; chưa đăng nhập, nút "Xem demo" mở chế độ *demo* với dữ liệu mẫu. Ở chế độ live, sau mỗi thao tác giao diện nạp lại từ backend thay vì tự sửa trạng thái, vì backend quyết định kết quả. Các trang mà backend chưa có API — ghi âm trực tiếp trên web, khách mời, mẫu giọng, tích hợp, mẫu biên bản, lưu trữ, nhật ký — mới là giao diện mẫu, chỉ có dữ liệu ở chế độ demo; trang Tri thức đã nối API và được trình bày ở mục hỏi đáp tri thức.

::figure fig-ui-dashboard | Màn hình tổng quan của người quản lý dự án

Màn hình tổng quan ([[fig-ui-dashboard]]) thay đổi theo vai trò. Với PM, trang hiển thị chỉ số nhanh (cuộc họp trong tuần, mục chờ duyệt, task đang mở, task quá hạn), lịch họp sắp tới, danh sách chờ duyệt và việc của tôi. Ô cảnh báo được tính ở giao diện theo quy tắc đơn giản (quá hạn, bị chặn, chưa có người thực hiện); phát hiện rủi ro tự động ở backend chưa triển khai.

::figure fig-ui-meetings | Danh sách cuộc họp với bộ lọc và giai đoạn xử lý

Danh sách cuộc họp ([[fig-ui-meetings]]) cho phép tìm kiếm, lọc theo dự án, hình thức (tải tệp, bot, extension, họp trực tiếp), thời gian, trạng thái. Mỗi cuộc họp mang giai đoạn hiển thị do backend gộp từ trạng thái cuộc họp, job xử lý gần nhất và trạng thái biên bản: đã lên lịch, đang xử lý, lỗi, chờ duyệt, hoàn tất.

::figure fig-ui-transcript | Màn hình transcript với nhãn ngôn ngữ, cảnh báo nói chồng và gán người nói

Màn hình transcript ([[fig-ui-transcript]]) hiển thị từng đoạn với người nói, mốc thời gian và ô tìm kiếm. Khi cuộc họp có từ hai thứ tiếng, mỗi đoạn có nhãn mã ngôn ngữ (VI, EN); đoạn có cờ nói chồng mang nhãn "Nói chồng · nên nghe lại". Cột bên phải liệt kê người nói, cho phép gán nhãn tự động với thành viên. Thanh phát âm thanh hiện mới mô phỏng; API cấp URL ký đã có nhưng giao diện chưa nối vào.

::figure fig-ui-minutes | Màn hình biên bản và vòng duyệt theo phiên bản

Màn hình biên bản ([[fig-ui-minutes]]) hiển thị tóm tắt, quyết định, vấn đề còn mở, công việc và phiên bản; nút thao tác đổi theo trạng thái: "Gửi duyệt" với bản nháp, "Duyệt biên bản" và "Từ chối" với bản chờ duyệt, "Mở bản nháp mới" với bản đã duyệt.

::figure fig-ui-review | Hàng đợi duyệt đề xuất công việc do AI trích xuất

Hàng đợi duyệt ([[fig-ui-review]]) nhóm đề xuất theo cuộc họp. Mỗi thẻ có dấu hiệu nội dung do AI sinh, mức tin cậy, các trường sửa được (người thực hiện, hạn) và câu trích nguyên văn làm bằng chứng; người duyệt chọn "Duyệt", "Sửa" hoặc "Loại". Đây là điểm kiểm soát của con người: chỉ sau khi duyệt, đề xuất mới thành task chính thức.

::figure fig-ui-board | Bảng công việc theo trạng thái

Bảng công việc ([[fig-ui-board]]) trình bày task theo bốn cột Todo, In Progress, Blocked, Done kèm dự án, hạn, ưu tiên; mở một task sẽ hiện ngăn chi tiết với bình luận.

::figure fig-ui-bot | Hộp thoại mời bot ghi âm vào cuộc họp Google Meet

Hộp thoại mời bot ([[fig-ui-bot]]) cho chọn cuộc họp trực tuyến trong lịch hoặc dán đường dẫn Google Meet mới; ở chế độ live chỉ có lựa chọn "Ngay bây giờ" vì Core chưa có bộ hẹn giờ cho bot. Sau khi mời, trang cuộc họp hỏi trạng thái bot mỗi 4 giây, hiển thị "Chờ chủ phòng cho vào", "Bot đang ghi âm" hoặc lý do thất bại cùng nút "Dừng bot".

## Triển khai và vận hành

Backend được mô tả trong một tệp `docker-compose.yml` gồm 12 dịch vụ ([[fig-deploy]]): PostgreSQL 15, Redis 7, RabbitMQ 3.11, MinIO, api-gateway, core-service, integration-service, ai-service, ai-worker, bot-worker, Prometheus và Grafana; frontend chạy riêng. ai-worker dùng chung ảnh với ai-service nhưng chạy tiến trình nhận việc từ RabbitMQ, còn ai-service chạy máy chủ FastAPI cổng 8000 phục vụ hỏi đáp cho core-service. Thứ tự khởi động ràng buộc bằng kiểm tra sức khoẻ; chỉ dịch vụ sở hữu schema được bật tự sinh bảng, tránh nhiều tiến trình cùng sửa bảng lúc khởi động. Tệp `init.sql` tạo ba schema `core`, `integration`, `ai` cùng ba tài khoản riêng và thu hồi quyền chéo giữa các schema.

::figure fig-deploy | Triển khai hệ thống bằng Docker Compose: các container và volume

Dữ liệu bền giữ trong năm volume: `postgres_data`, `minio_data`, `grafana_data`, `whisper-models` (mô hình Whisper và ERes2Net, tải lần đầu) và `bot-profile` (hồ sơ Chromium đã đăng nhập tài khoản bot). Cấu hình đi qua biến môi trường: `AI_STT`, `AI_WHISPER_MODEL`, `AI_DIARIZATION` cho phiên âm; `AI_LLM`, `AI_LLM_MODEL`, `AI_LLM_FALLBACK_MODEL` cho phân tích; `BOT_ADMISSION_TIMEOUT_S`, `BOT_ALONE_TIMEOUT_S` cho bot; `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_BOARD_ID` (hoặc `TRELLO_LIST_ID`), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` cho đồng bộ; `AI_EMBEDDING_MODEL`, `AI_RERANK_MODEL`, `AI_QA_MODEL`, `AI_QA_FALLBACK_MODEL`, `AI_INTERNAL_TOKEN` cho hỏi đáp. Tệp `.env` chứa khoá LLM, khoá nội bộ giữa Core và ai-service, khoá Trello, token Telegram và khoá ký gói extension (`*.pem`) đều bị `.gitignore` loại; các mật khẩu mặc định trong `docker-compose.yml` chỉ dành cho môi trường phát triển.

Về giám sát, Prometheus và Grafana đã được khai báo nhưng chưa có cấu hình thu thập số liệu, các dịch vụ cũng chưa xuất điểm cuối số liệu, nên giám sát mới ở mức khung. Khi vận hành và gỡ lỗi, nhóm dựa vào log của từng dịch vụ, trang quản trị RabbitMQ để xem hàng đợi, giao diện MinIO để kiểm tra object, trạng thái trong `processing_jobs`, `bot_sessions`, và ảnh chụp từng bước của bot.

## Kiểm thử phần mềm

### Kiểm thử đơn vị

Nguyên tắc giúp kiểm thử là tách phần quyết định thành hàm thuần, độc lập với mô hình và mạng: ở ai-worker, các hàm chọn ngôn ngữ, cắt khúc, gom cụm, phát hiện nói chồng, dựng prompt, bóc JSON, đối chiếu bằng chứng đều là hàm thuần; phần gọi LLM được kiểm thử bằng `httpx.MockTransport` giả lập lỗi 402, nội dung rỗng, JSON bị cắt. Mô-đun hỏi đáp theo cùng cách: chia đoạn, chọn nguồn sau xếp hạng lại, đánh số lại trích dẫn là hàm thuần; câu SQL tìm kiếm được kiểm tra có chứa điều kiện lọc cuộc họp; API nội bộ được kiểm tra với khoá sai, thiếu khoá và danh sách cuộc họp rỗng. Toàn bộ 81 ca của ai-service chạy không cần tải mô hình hay gọi mạng. Ở integration-service, các lời gọi Trello và Telegram được thay bằng bản giả lập để kiểm thử từng nhánh: tạo thẻ rồi báo tin, dùng lại thẻ đã có dòng đánh dấu, job đã thành công không gọi API lại, thiếu cấu hình thì bỏ qua, lỗi của một bên không chặn bên kia, khoá không lộ trong lỗi, log, cơ sở dữ liệu và sự kiện. Tất cả các ca trong bảng [[tb-tests]] đều đạt ở lần chạy gần nhất.

::table tb-tests | Tổng hợp kiểm thử đơn vị
| Thành phần | Công cụ | Số ca | Nội dung chính |
|---|---|---|---|
| ai-worker – nhận dạng tiếng nói | pytest | 8 | Họp nói lẫn Việt – Anh, đoạn ngắn giữ ngôn ngữ, tỷ lệ ngôn ngữ |
| ai-worker – tách người nói | pytest | 15 | Cắt khúc, gom cụm, gộp cụm nhỏ, nói chồng, lọc câu bịa |
| ai-worker – phân tích LLM | pytest | 21 | Prompt, bóc JSON, đối chiếu số dòng, mô hình dự phòng, gọi theo luồng, quá giờ |
| ai-worker, ai-service – hỏi đáp tri thức | pytest | 37 | Chia đoạn, truy xuất, đánh số lại trích dẫn, khoá nội bộ, bộ lọc quyền trong SQL, reranker lỗi |
| bot-worker | pytest | 3 | Ép `hl=en`, so khớp tiền tố nhãn nút |
| Extension | node:test | 7 | Phần chưa gửi của phụ đề, nạp content script chung phạm vi |
| integration-service | Jest | 20 | Đồng bộ Trello/Telegram, chống lặp, ẩn khoá |

Core-service chưa có bộ kiểm thử đơn vị do nhóm viết (các tệp `*.spec.ts` hiện có thuộc khung mẫu); luồng nghiệp vụ của nó được kiểm chứng bằng kiểm thử đầu-cuối.

### Kiểm thử tích hợp đầu-cuối

Kiểm thử đầu-cuối chạy trên toàn hệ thống bằng Docker Compose, gọi API như frontend và extension rồi đối chiếu cơ sở dữ liệu. Lát cắt đầu tiên dùng STT và LLM giả lập để xác nhận đường đi của sự kiện tới biên bản nháp. Với đường tải tệp, nhóm tải lên tệp WAV 64 KB, tải lại qua URL ký từ ngoài mạng Docker thấy khớp đủ 64.044 byte, rồi chạy tiếp ra transcript và biên bản nháp. Extension được thử trên phòng Google Meet thật ngày 29/10/2026; giao diện được chạy với backend thật ngày 30/10/2026 qua các thao tác từ đăng nhập, tạo cuộc họp, tải tệp tới duyệt đề xuất, duyệt biên bản và bảng công việc. Cuối cùng, bot và các mô-đun AI được chạy với phòng Google Meet và bản ghi thật, luồng đồng bộ được chạy với tài khoản Trello và bot Telegram thật, chức năng hỏi đáp được chấm qua API của Core trên dữ liệu đã có trong hệ thống. Đánh giá định lượng độ chính xác và thời gian xử lý trình bày ở chương Thực nghiệm và đánh giá ([[fig-wer]], [[fig-llm-models]], [[fig-timing]]).

### Lỗi phát hiện và cách khắc phục

Ngoài các lỗi chức năng đã nêu ở từng mục, kiểm thử phát hiện một số lỗi bảo mật và tính đúng đắn ở core-service, phần lớn kế thừa từ khung mẫu ban đầu (bảng [[tb-bugs]]).

::table tb-bugs | Các lỗi bảo mật và tính đúng đắn phát hiện trong quá trình kiểm thử
| Lỗi phát hiện | Hậu quả | Cách khắc phục |
|---|---|---|
| Bộ điều khiển `/user/*` khai `authorize: false` | Gọi được không cần đăng nhập, lấy được danh sách người dùng kèm băm mật khẩu, tạo được tài khoản SUPER_ADMIN | CRUD người dùng chỉ cho SUPER_ADMIN; tự đăng ký qua `/auth/register`, luôn là tài khoản thường |
| Đổi mật khẩu truyền `null` thay người dùng, ghi mật khẩu cũ dạng rõ | Chức năng luôn lỗi, nguy cơ lưu mật khẩu không băm | Lấy người dùng từ token, so mật khẩu cũ với băm, lưu băm bcrypt mật khẩu mới |
| Dòng băm mật khẩu khi tạo người dùng bị chú thích mất | Mật khẩu lưu dạng rõ | Bật lại băm bcrypt |
| `/user/me` thiếu guard và trả cả trường mật khẩu | Lỗi 500, lộ băm mật khẩu | Gắn `Authorization()`, bỏ trường mật khẩu khỏi phản hồi |
| Tạo workspace nhận `ownerId` từ client | Tạo được workspace đứng tên người khác | Người gọi luôn là chủ sở hữu |
| Cuộc họp không thuộc dự án không ai truy cập được | Người tạo cũng không xem được | Luôn `restricted`, người tạo nhận vai trò MANAGER |
| Tuyến CRUD `/note` cho người xem cuộc họp đọc ghi chú riêng của người khác | Lộ ghi chú cá nhân | Khoá CRUD chung cho SUPER_ADMIN; người dùng đi qua tuyến nghiệp vụ đã lọc ghi chú riêng |
| Cuộc họp tải tệp ghi âm vẫn ở trạng thái "đã lên lịch" sau khi có transcript | Giao diện ẩn tab transcript | Chuyển cuộc họp sang "đã kết thúc" khi nhận transcript từ bản ghi |
| Tải cùng nội dung cho cuộc họp khác trả về bản ghi tệp của cuộc họp cũ | Tệp gắn sai cuộc họp | Khử trùng lặp trong phạm vi từng cuộc họp |
| Bộ chống lặp coi mọi lỗi khi ghi `processed_messages` là tin trùng | Lỗi cơ sở dữ liệu tạm thời làm mất tin | Chỉ lỗi vi phạm khoá duy nhất mới coi là trùng; lỗi khác được ném ra để tin được giao lại |

Bài học rút ra là mọi tuyến kế thừa từ khung mẫu phải được rà theo ma trận quyền, và thông tin danh tính (chủ sở hữu, người tạo) phải lấy từ token chứ không nhận từ client. Hạn chế bảo mật đã biết còn lại là dữ liệu hội thoại chưa được mã hoá khi lưu mà chỉ được bảo vệ bằng phân quyền.

## Kết luận chương

Chương này đã trình bày việc xây dựng MeetingMind từ thiết kế thành hệ thống chạy được. Core-service tập trung phân quyền ở `PermissionService` và giao tiếp bất đồng bộ qua outbox, RabbitMQ với cơ chế chống xử lý lặp. Ba đường thu nhận — tải tệp, bot ghi âm Google Meet, extension đọc phụ đề — đã hoạt động và hội tụ tại phiên bản transcript. Ba mô-đun AI đã được gắn thật: phiên âm hai lượt theo ngôn ngữ từng đoạn, tách người nói bằng gom cụm vector giọng, phân tích biên bản bằng LLM có mô hình dự phòng và đối chiếu bằng chứng; kết quả AI luôn qua hàng đợi duyệt trước khi thành dữ liệu chính thức. Công việc đã duyệt được integration-service đẩy sang Trello và báo qua Telegram, có chống tạo trùng ở ba lớp và đã chạy với tài khoản thật. Tri thức của các cuộc họp được lập chỉ mục vector trong PostgreSQL để hỏi đáp có trích nguồn, với quyền được lọc ở Core, ngay trong câu SQL và kiểm tra lại trên từng trích dẫn.

Phần khó nhất nằm ở các tình huống thực tế hơn là ở việc gọi mô hình. Phần chưa hoàn thiện gồm bọc giao dịch cho outbox, sinh bản ghi trích dẫn khi duyệt, nối trình phát âm thanh, cấu hình giám sát, kiểm thử tự động cho core-service, mã hoá dữ liệu khi lưu; tích hợp Trello, Telegram mới ở mức MVP (cấu hình qua biến môi trường, đồng bộ một chiều, chưa có hàng đợi thư chết) và đồng bộ Jira còn ở mức thiết kế. Hỏi đáp tri thức đã lưu hội thoại phía máy chủ và đọc được tài liệu quét, nhưng chưa được đánh giá trên kho cuộc họp thật quy mô lớn. Chương Thực nghiệm và đánh giá tiếp theo sẽ đo định lượng độ chính xác và thời gian xử lý.
