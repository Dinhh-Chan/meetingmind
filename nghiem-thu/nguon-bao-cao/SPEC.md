# Quy ước viết báo cáo nghiệm thu đề tài 18-SV-2026-RIPT

Đề tài: **Thiết kế và triển khai hệ thống Meet-Assistant: Tự động hóa take-note và đồng bộ hóa quản lý công việc** (sản phẩm: hệ thống **MeetingMind**). Mã số 18-SV-2026-RIPT. Chủ trì: Trần Đức Định (B23DCCC038, D23CCPM01). Thành viên: Hoàng Nguyễn Trà My (B23DCCC116, D23CCPM02). GVHD: TS. Lê Văn Hoàng. Học viện Công nghệ Bưu chính Viễn thông — Viện Khoa học Kỹ thuật Bưu điện. Thời gian 05/2026–11/2026.

Repo: `/home/dinh-tran/Documents/ki1nam4/laptrinhwebnangcao/meetingmind` (backend + extension + bot-worker + ai-service), frontend ở `meeting-mind-fe/` (Next.js). Tài liệu thiết kế gốc: `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `contracts/events.json`. Báo cáo tiến độ cũ (07/10/2026): `bao-cao-tien-do/BaoCao_TienDo_18-SV-2026-RIPT.pdf` (dùng `pdftotext -layout` để đọc). Đề cương: `18-SV-2026-RIPT.pdf`. Mô tả website: `MeetingMind.pdf`.

## 1. Nguyên tắc nội dung (BẮT BUỘC)

- **Trung thực.** Chỉ mô tả là "đã làm / đã chạy" những gì có trong code. Kiểm tra code trước khi khẳng định. Những thứ CHƯA có code — đồng bộ Jira/Trello, cảnh báo Telegram, hỏi đáp RAG, thuật toán phát hiện rủi ro tự động, mã hoá dữ liệu hội thoại khi lưu — chỉ được trình bày ở dạng *thiết kế/hướng phát triển*, ghi rõ "chưa triển khai" hoặc "đang hoàn thiện". Không bịa số liệu đo đạc; số liệu thực nghiệm chỉ lấy từ `scratchpad/eval/results/*.json`, `scratchpad/llm_bench/out/*.json` (do người điều phối cung cấp ở Chương 4).
- Văn phong học thuật tiếng Việt, câu rõ ràng, không sáo rỗng, không liệt kê thừa. Thuật ngữ tiếng Anh để trong ngoặc ở lần đầu: "nhận dạng tiếng nói (Speech-to-Text, STT)". Viết "chúng tôi"/"nhóm nghiên cứu" khi nói về nhóm.
- Đoạn văn là chính; gạch đầu dòng chỉ khi thật sự là danh sách. Mỗi mục nên có ít nhất 2–4 đoạn văn thực chất.
- Dùng trích dẫn `[@key]` từ danh sách tài liệu tham khảo ở mục 4 khi nêu khái niệm/kết quả của người khác. Không bịa tài liệu ngoài danh sách.

## 2. Cú pháp file nội dung (.md)

```
# Tên chương                 -> "CHƯƠNG N. TÊN CHƯƠNG" (tự đánh số, sang trang mới)
#! MỞ ĐẦU                    -> chương không đánh số (Mở đầu, Kết luận và kiến nghị)
## Tên mục                   -> "N.M. Tên mục" (tự đánh số; trong chương không số: "1.", "2.")
### Tên tiểu mục             -> "N.M.K. Tên tiểu mục"
#### Tiêu đề nhỏ             -> in đậm, không đánh số

Đoạn văn thường. Hỗ trợ **đậm**, *nghiêng*, `mã`, trích dẫn [@radford2023], tham chiếu [[fig-architecture]] / [[tb-tech]].

- gạch đầu dòng
  - gạch đầu dòng cấp 2 (thụt 2 dấu cách)
1. danh sách đánh số

::table tb-tech | Công nghệ sử dụng trong hệ thống
| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| Backend | NestJS | ... |

::figure fig-architecture | Kiến trúc tổng thể hệ thống MeetingMind | 15
   (nhãn | chú thích | độ rộng cm, tuỳ chọn, mặc định 15; ảnh lấy từ figures/<nhãn>.png)

```python
khối mã (ngắn, tối đa ~15 dòng)
```

> Ghi chú/nhấn mạnh (in nghiêng, thụt lề)
```

Tham chiếu `[[nhãn]]` sẽ được thay bằng "Hình 2.3" / "Bảng 3.1" tự động. Nhãn bảng bắt đầu bằng `tb-`, hình bằng `fig-`. KHÔNG tự viết số chương/mục/bảng/hình.

## 3. Danh mục hình (người vẽ: agent sơ đồ; người viết chỉ chèn bằng ::figure)

| Nhãn | Nội dung | Chương dùng |
|---|---|---|
| fig-whisper | Kiến trúc Whisper: log-Mel → encoder Transformer → decoder Transformer với token đặc biệt (ngôn ngữ, nhiệm vụ, mốc thời gian) | 1 |
| fig-diarization | Quy trình tách người nói: VAD/đoạn lời → cửa sổ ~1,5 s → vector đặc trưng giọng (ERes2Net) → gom cụm phân cấp cosine → gộp cụm nhỏ → lượt nói + đánh dấu nói chồng | 1, 3 |
| fig-llm-extract | Trích xuất có cấu trúc bằng LLM: transcript đánh số dòng → prompt quy tắc → JSON → chuẩn hoá & đối chiếu bằng chứng → hàng đợi duyệt | 1, 3 |
| fig-usecase | Sơ đồ ca sử dụng: tác nhân Owner/Admin, PM/Trưởng nhóm, Thành viên, Khách mời, Bot/AI; ca: quản lý workspace/dự án, tạo cuộc họp, mời bot, ghi âm/tải file, xem transcript, gán người nói, duyệt biên bản/đề xuất, quản lý task, xem cảnh báo | 2 |
| fig-architecture | Kiến trúc tổng thể: Frontend Next.js, Extension Chrome → API Gateway → core-service; RabbitMQ nối core ↔ ai-worker, bot-worker, integration-service; PostgreSQL (schema core/ai/integration), Redis, MinIO; Prometheus/Grafana | 2 |
| fig-pipeline | Luồng xử lý từ âm thanh đến công việc: 3 đường thu nhận → MinIO/transcript → STT+tách người nói → transcript_version → LLM → biên bản nháp + review_items → PM duyệt → action_items → (đồng bộ ngoài: thiết kế) | 2 |
| fig-sequence | Sơ đồ tuần tự sự kiện: Core ghi outbox trong transaction → publisher đẩy RabbitMQ → ai-worker xử lý → transcription.completed → Core ghi processed_messages, tạo version → analysis.requested → analysis.completed | 2 |
| fig-erd | Sơ đồ quan hệ các bảng chính schema core: workspaces, projects, meetings, transcript_versions, transcript_segments, speaker_aliases, meeting_minutes, minutes_versions, review_batches, review_items, action_items, action_item_citations, processing_jobs, outbox_events | 2 |
| fig-scope | Phân quyền theo vai trò + phạm vi: Hệ thống → Workspace → Dự án → Cuộc họp, vai trò từng tầng | 2 |
| fig-capture | Ba đường thu nhận hội tụ: tải file (MinIO), bot Google Meet (ghi âm), extension (phụ đề) → transcript_versions | 3 |
| fig-bot-states | Trạng thái phiên bot: requested → joining → waiting_admission → recording → uploading → completed / failed (lý do: bị từ chối, hết giờ chờ, ở một mình, lỗi) | 3 |
| fig-stt-twopass | Phiên âm hai lượt: nhận diện ngôn ngữ chính → phiên âm có VAD → với từng đoạn ≥1,5 s nhận diện lại ngôn ngữ → nếu khác & đủ chắc (≥0,7) thì phiên âm lại đoạn đó | 3 |
| fig-deploy | Triển khai Docker Compose: các container và volume | 3 |
| fig-ui-dashboard, fig-ui-meetings, fig-ui-transcript, fig-ui-minutes, fig-ui-review, fig-ui-board, fig-ui-bot | Ảnh chụp giao diện (người điều phối chụp) | 3 |
| fig-wer, fig-llm-models, fig-timing | Biểu đồ kết quả (người điều phối vẽ) | 4 |

## 4. Tài liệu tham khảo (khoá → dùng `[@khoá]`)

- atlassian-jira: Atlassian (2026), *Jira Cloud platform REST API v3*, https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- atlassian-trello: Atlassian (2026), *Trello REST API*, https://developer.atlassian.com/cloud/trello/rest/
- baevski2020: Baevski et al. (2020), wav2vec 2.0 — tự học biểu diễn tiếng nói, NeurIPS 2020
- bredin2020: Bredin et al. (2020), pyannote.audio — khối xây dựng diarization, ICASSP 2020
- brown2020: Brown et al. (2020), Language models are few-shot learners (GPT-3), NeurIPS 2020
- carletta2005: Carletta et al. (2005), AMI meeting corpus, MLMI 2005
- chen2023eres2net: Chen et al. (2023), Enhanced Res2Net (ERes2Net) cho xác minh người nói, Interspeech 2023
- deepseek2024: DeepSeek-AI (2024), DeepSeek-V3 Technical Report, arXiv:2412.19437
- fireflies: Fireflies.ai (2026), trang sản phẩm
- fpt-aifactory: FPT Smart Cloud (2026), tài liệu FPT AI Factory – Serverless Inference
- glm2024: Team GLM (2024), ChatGLM: từ GLM-130B đến GLM-4, arXiv:2406.12793
- google-mv3: Google (2026), tài liệu Chrome Extensions Manifest V3
- hardt2012: Hardt (2012), RFC 6749 – OAuth 2.0 Authorization Framework
- hu2014: Hu et al. (2014), NIST SP 800-162 – ABAC
- ji2023: Ji et al. (2023), Survey of hallucination in NLG, ACM Computing Surveys
- k2fsa-sherpa: k2-fsa (2026), sherpa-onnx (GitHub)
- kleppmann2017: Kleppmann (2017), Designing Data-Intensive Applications
- levenshtein1966: Levenshtein (1966), khoảng cách chỉnh sửa (cơ sở của WER)
- luong2016vivos: Luong & Vu (2016), công thức Kaldi cho nhận dạng tiếng Việt (bộ VIVOS)
- microsoft-playwright: Microsoft (2026), tài liệu Playwright
- nestjs: Myśliwiec (2026), tài liệu NestJS
- newman2021: Newman (2021), Building Microservices, 2nd ed.
- otter: Otter.ai (2026), trang sản phẩm
- park2022: Park et al. (2022), A review of speaker diarization, Computer Speech & Language
- rabbitmq: RabbitMQ (2026), tài liệu RabbitMQ
- radford2023: Radford et al. (2023), Whisper – Robust speech recognition via large-scale weak supervision, ICML 2023
- richardson2018: Richardson (2018), Microservices Patterns (transactional outbox, saga)
- sandhu1996: Sandhu et al. (1996), Role-based access control models, IEEE Computer
- snyder2018: Snyder et al. (2018), X-vectors, ICASSP 2018
- systran-fw: SYSTRAN (2026), faster-whisper (GitHub)
- tactiq: Tactiq (2026), trang sản phẩm
- telegram-bot: Telegram (2026), Telegram Bot API
- vaswani2017: Vaswani et al. (2017), Attention is all you need, NeurIPS 2017
- w3c-webrtc: W3C (2021), WebRTC 1.0 Recommendation
- wei2022: Wei et al. (2022), Chain-of-thought prompting, NeurIPS 2022
- zhong2021qmsum: Zhong et al. (2021), QMSum – tóm tắt cuộc họp theo truy vấn, NAACL 2021

## 5. Sự thật kỹ thuật đã kiểm chứng (dùng được ngay)

- 5 backend + frontend + extension; Docker Compose (12 service, frontend chạy ngoài compose gồm postgres, rabbitmq, redis, minio, prometheus, grafana, api-gateway, core-service, ai-service, ai-worker, integration-service, bot-worker). api-gateway và integration-service hiện mới là khung (base template NestJS), chưa có nghiệp vụ tích hợp.
- core-service (NestJS + Sequelize, PostgreSQL schema `core`): 64 module, ~29 nghìn dòng TypeScript. Frontend Next.js 16: 29 trang, ~14,7 nghìn dòng TS/TSX. ai-service ~2,5 nghìn dòng Python. bot-worker ~760 dòng. Extension ~700 dòng.
- CSDL thiết kế 43 bảng, 3 schema (core, integration, ai), 3 tài khoản DB riêng. 54 quyền dạng `<tài nguyên>.<hành động>`. Vai trò theo phạm vi: hệ thống (SUPER_ADMIN, USER), workspace (OWNER, ADMIN, MEMBER, VIEWER), dự án (PM, MEMBER, VIEWER), cuộc họp độc lập (MANAGER, EDITOR, VIEWER).
- Sự kiện RabbitMQ: transcription.requested/completed/failed, analysis.requested/completed/failed, bot.join.requested, bot.stop.requested, bot.status.changed, recording.completed. Outbox + processed_messages + idempotencyKey.
- STT: faster-whisper 1.2.1 (CTranslate2), model `small`, CPU int8; nhận diện ngôn ngữ 2 lượt theo đoạn (ngưỡng 0,7, đoạn ≥ 1,5 s); chống "ảo giác" Whisper: `condition_on_previous_text=False`, `hallucination_silence_threshold=2.0`, lọc câu rác kiểu "đăng ký kênh", "thanks for watching".
- Tách người nói: sherpa-onnx 2.0.1, vector đặc trưng giọng 3D-Speaker ERes2Net; cửa sổ ~1,5 s theo lời (word timestamps); gom cụm phân cấp average-linkage, gộp khi độ tương đồng cosine ≥ 0,3; cụm < 2 s gộp vào cụm gần nhất; đánh dấu nói chồng thích nghi (median + 2×MAD, sàn 0,3). Đã thử pyannote segmentation trước nhưng gộp nhầm người → chuyển sang gom cụm cửa sổ.
- LLM: FPT AI Factory Serverless Inference (API kiểu OpenAI, `https://token-api.fpt.ai/v1`). Model chính DeepSeek-V4.1-Flash, dự phòng GLM-5.2 (cả hai FPT tự host). Không dùng response_format json (DeepSeek-V4.1 trả rỗng khi bật). Kết quả chuẩn hoá: priority ∈ {high, medium, low}, confidence ∈ [0,1], "null"/"N/A" → rỗng, dò lại số dòng bằng chứng theo câu trích. Quy tắc prompt: đề xuất ≠ quyết định; đính chính lấy thông tin cuối; bỏ chuyện ngoài lề; không bịa người/hạn.
- AI không ghi thẳng bảng nghiệp vụ: Core tạo minutes_version (DRAFT) + review_batch + review_items (action_item / decision / open_issue); PM sửa/duyệt/từ chối; duyệt action item mới sinh task chính thức.
- Bot Google Meet: Playwright Chromium headful dưới Xvfb, PulseAudio null sink, ghi âm bằng Proxy RTCPeerConnection + AudioContext + MediaRecorder (webm/opus); tài khoản Google riêng cho bot (profile lưu volume); giao diện Meet ép tiếng Anh (`hl=en`); chờ người tổ chức cho vào (300 s), tự rời khi ở một mình 60 s; tải bản ghi lên MinIO rồi phát recording.completed → Core tự đăng ký file và chạy phiên âm. Google chặn khách ẩn danh dùng trình duyệt tự động → bắt buộc tài khoản đăng nhập.
- Extension Chrome MV3: đọc phụ đề Meet theo cấu trúc DOM (`[role=region][aria-label=Captions]`), theo dõi phần chưa gửi của từng dòng để không lặp chồng, gửi lô 5 s, refresh token, đệm lại khi lỗi mạng.
- Bảo mật đã làm: JWT, bcrypt mật khẩu, vá route /user/* mở không cần đăng nhập, đổi mật khẩu phải kiểm tra mật khẩu cũ, ownerId workspace không cho client tự đặt, cuộc họp không dự án mặc định RESTRICTED, API key LLM để trong .env đã gitignore. Chưa làm: mã hoá dữ liệu hội thoại khi lưu (at-rest), chỉ dựa vào phân quyền.
- Kiểm thử: ai-service 41 unit test (pytest), bot-worker 3 test, extension có test Node (caption-text), kiểm thử đầu-cuối trên Docker Compose.
