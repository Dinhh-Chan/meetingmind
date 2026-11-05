"""Slide báo cáo nghiệm thu (16:9). Số liệu lấy từ file kết quả thực nghiệm."""

import json
import os
import subprocess

from pptx.enum.text import MSO_ANCHOR, PP_ALIGN

from pptlib import BLACK, DARK, GREEN, GREY, LIGHT, PTIT_RED, RED, RIPT_BLUE, TITLE_FONT, WHITE, Deck

HERE = os.path.dirname(os.path.abspath(__file__))
FIG = os.path.join(HERE, "figures")
OUT = os.path.join(HERE, "out")
# Số liệu thực nghiệm: ../eval (scratchpad lúc làm) hoặc ../thuc-nghiem (trong repo).
_SUMMARY = [os.path.join(os.path.dirname(HERE), d, "summary.json") for d in ("eval", "thuc-nghiem")]
SUMMARY = json.load(open(next(p for p in _SUMMARY if os.path.exists(p))))
LLM = json.load(open(os.path.join(FIG, "llm_summary.json")))


def fig(name):
    return os.path.join(FIG, name + ".png")


def run(model, variant):
    return next((r for r in SUMMARY if r["model"] == model and r["variant"] == variant), None)


def pct(x):
    return f"{x * 100:.1f}".replace(".", ",")


d = Deck(os.path.join(HERE, "mau", "mau-slide-ptit.pptx"))

# 1. Bìa (theo slide bìa của mẫu) --------------------------------------------
s = d.cover()
d.text(s, 0.8, 1.3, 11.7, 0.5, "BÁO CÁO NGHIỆM THU ĐỀ TÀI NGHIÊN CỨU KHOA HỌC SINH VIÊN NĂM 2026", size=18, bold=True, color=PTIT_RED, align=PP_ALIGN.CENTER, font=TITLE_FONT)
d.text(s, 0.6, 1.9, 12.1, 2.3, ["THIẾT KẾ VÀ TRIỂN KHAI HỆ THỐNG", "MEET-ASSISTANT: TỰ ĐỘNG HÓA TAKE-NOTE VÀ", "ĐỒNG BỘ HÓA QUẢN LÝ CÔNG VIỆC"], size=32, bold=True, color=BLACK, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, font=TITLE_FONT)
d.text(s, 0.8, 4.35, 11.7, 0.5, "Mã số: 18-SV-2026-RIPT  ·  Sản phẩm: hệ thống MeetingMind", size=20, color=BLACK, align=PP_ALIGN.CENTER, font=TITLE_FONT)
# Trên dải đỏ: như mẫu, chữ đen, lệch phải
d.text(s, 7.2, 5.55, 5.9, 1.8, ["Chủ trì: Trần Đức Định", "DinhTD.B23CC038@stu.ptit.edu.vn", "Thành viên: Hoàng Nguyễn Trà My", "GVHD: TS. Lê Văn Hoàng"], size=20, color=BLACK, font=TITLE_FONT)

# 2. Nội dung ----------------------------------------------------------------
s = d.new("Nội dung trình bày")
items = ["Đặt vấn đề, mục tiêu và phạm vi", "Kiến trúc và luồng xử lý của hệ thống", "Các mô-đun AI, đồng bộ Trello, Telegram và hỏi đáp tri thức", "Giao diện hệ thống", "Thực nghiệm và đánh giá", "Đối chiếu với đề cương, kết luận và hướng phát triển"]
for i, t in enumerate(items):
    y = 1.45 + i * 0.88
    d.rect(s, 1.3, y, 0.7, 0.62, fill=PTIT_RED if i % 2 == 0 else RIPT_BLUE)
    d.text(s, 1.3, y, 0.7, 0.62, str(i + 1), size=22, bold=True, color=WHITE, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    d.text(s, 2.25, y, 9.5, 0.62, t, size=21, color=DARK, anchor=MSO_ANCHOR.MIDDLE)

# 3. Đặt vấn đề --------------------------------------------------------------
s = d.new("Đặt vấn đề")
d.bullets(s, 0.6, 1.35, 7.2, 5.4, [
    "Sau mỗi cuộc họp, ai đó phải **ghi biên bản và tạo công việc bằng tay** → tốn thời gian, dễ sót việc, sai người, sai hạn",
    "Người ghi chép **không tập trung thảo luận** được",
    "Công cụ nước ngoài (Otter.ai, Fireflies.ai…): **chi phí cao**, tiếng Việt và thuật ngữ chuyên ngành chưa tốt",
    "Giải pháp trong nước mới dừng ở **transcript thô** hoặc tóm tắt đơn giản, chưa nối sang quản lý công việc",
    "Rủi ro của AI: **bịa người làm, bịa hạn**, nhầm đề xuất thành quyết định",
], size=18)
d.rect(s, 8.2, 1.45, 4.6, 5.1, fill=LIGHT)
d.text(s, 8.45, 1.6, 4.1, 0.5, "Câu hỏi nghiên cứu", size=19, bold=True, color=PTIT_RED)
d.text(s, 8.45, 2.2, 4.1, 4.2, "Có thể tự động hoá trọn chuỗi **âm thanh → transcript → biên bản → công việc** cho cuộc họp tiếng Việt, với chi phí thấp, chạy được trên phần cứng phổ thông, mà vẫn giữ con người kiểm soát kết quả của AI?", size=19, color=DARK)

# 4. Mục tiêu ----------------------------------------------------------------
s = d.new("Mục tiêu và phạm vi")
d.text(s, 0.6, 1.3, 6, 0.5, "Mục tiêu", size=21, bold=True, color=PTIT_RED)
d.bullets(s, 0.6, 1.85, 6.1, 4.8, [
    "Chuyển hội thoại cuộc họp thành văn bản (STT), phân biệt người nói",
    "Dùng LLM tóm tắt, tách **quyết định, vấn đề mở, công việc** kèm người làm và thời hạn",
    "AI chỉ đề xuất, **con người duyệt** rồi mới giao việc",
    "Đồng bộ việc đã duyệt sang **Trello**, báo **Telegram**; mở rộng được sang Jira",
    "Đánh giá định lượng độ chính xác và thời gian xử lý",
    "(Bổ sung) **Hỏi đáp tri thức** cuộc họp có trích nguồn, lọc quyền",
], size=17)
d.text(s, 7.0, 1.3, 5.8, 0.5, "Phạm vi", size=21, bold=True, color=PTIT_RED)
d.bullets(s, 7.0, 1.85, 5.8, 3.0, [
    "Tiếng Việt, có xen tiếng Anh",
    "Google Meet (bot và tiện ích đọc phụ đề), tệp ghi âm họp trực tiếp",
    "Nhóm dự án nhỏ, máy chủ không bắt buộc GPU",
], size=17)
d.rect(s, 7.0, 4.75, 5.8, 1.85, fill=LIGHT)
d.text(s, 7.2, 4.85, 5.4, 1.7, ["**Sản phẩm giao nộp**", "01 hệ thống phần mềm web MeetingMind", "02 quyển báo cáo kết quả đề tài"], size=17, color=DARK)

# 5. Kiến trúc ---------------------------------------------------------------
s = d.new("Kiến trúc tổng thể")
d.image(s, fig("fig-architecture"), 0.35, 1.15, 8.9, 5.8)
d.bullets(s, 9.4, 1.3, 3.7, 5.6, [
    "**5 dịch vụ backend**, giao diện web, tiện ích Chrome; Docker Compose 12 service",
    "Core điều phối, AI chỉ trả kết quả qua sự kiện",
    "RabbitMQ + **outbox + chống xử lý lặp**",
    "PostgreSQL tách schema theo dịch vụ, **43 bảng**",
    "Phân quyền theo vai trò + phạm vi: **54 quyền**",
], size=15, gap=8)

# 6. Luồng xử lý -------------------------------------------------------------
s = d.new("Luồng xử lý: từ âm thanh đến công việc")
d.image(s, fig("fig-pipeline"), 0.4, 1.15, 12.5, 5.85)

# 7. Ba đường thu nhận --------------------------------------------------------
s = d.new("Ba đường thu nhận nội dung cuộc họp")
d.image(s, fig("fig-capture"), 0.35, 1.15, 8.3, 5.8)
d.bullets(s, 8.85, 1.3, 4.2, 5.6, [
    "**Tải tệp**: MinIO, khử trùng lặp SHA-256, URL ký",
    "**Bot Google Meet**: Playwright + Xvfb + PulseAudio, ghi âm WebRTC; tài khoản Google riêng (Google chặn khách ẩn danh dùng trình duyệt tự động)",
    "**Tiện ích Chrome**: đọc phụ đề Meet theo cấu trúc DOM, gửi lô 5 s, không cần bot",
    "Ba đường gặp nhau ở **transcript theo phiên bản**",
], size=15, gap=8)

# 8. STT ------------------------------------------------------------------------
s = d.new("Phiên âm tiếng Việt và xen tiếng Anh")
d.image(s, fig("fig-stt-twopass"), 0.35, 1.15, 7.9, 5.8)
d.bullets(s, 8.45, 1.3, 4.6, 5.6, [
    "**faster-whisper** (Whisper small, int8, CPU)",
    "Phiên âm **hai lượt**: đoạn ≥ 1,5 s nhận diện lại ngôn ngữ, đủ chắc (≥ 0,7) thì phiên âm lại bằng đúng ngôn ngữ",
    "Chống **ảo giác**: VAD, không mượn ngữ cảnh câu trước, bỏ đoạn bịa giữa khoảng lặng, lọc câu rác",
    "Lưu ngôn ngữ cho **từng đoạn**",
], size=15, gap=8)

# 9. Tách người nói ---------------------------------------------------------------
s = d.new("Tách người nói (họp trực tiếp, một micro)")
d.image(s, fig("fig-diarization"), 0.35, 1.15, 8.6, 5.8)
d.bullets(s, 9.15, 1.3, 3.9, 5.6, [
    "Cửa sổ ~1,5 s theo mốc từ của Whisper",
    "Vector giọng **ERes2Net** (sherpa-onnx, CPU)",
    "Gom cụm phân cấp, gộp khi tương đồng cosine ≥ 0,3; cụm < 2 s gộp vào cụm gần nhất",
    "Không cần biết trước số người",
    "Gán nhãn \"Người nói 1, 2…\", người dùng gán tên thật",
], size=15, gap=8)

# 10. LLM ----------------------------------------------------------------------------
s = d.new("Trích xuất biên bản bằng LLM")
d.image(s, fig("fig-llm-extract"), 0.35, 1.15, 12.6, 4.25)
d.bullets(s, 0.6, 5.5, 12.2, 1.5, [
    "Prompt có quy tắc chống bịa: **đề xuất ≠ quyết định**, đính chính lấy thông tin cuối, bỏ chuyện ngoài lề, thiếu người/hạn thì để trống",
    "Chuẩn hoá đầu ra, **dò lại câu trích dẫn** trong transcript; mô hình dự phòng khi lỗi; kết quả vào **hàng đợi duyệt**",
], size=15, gap=4)

# 11. Đồng bộ Trello + Telegram ----------------------------------------------------
s = d.new("Đồng bộ Trello và cảnh báo Telegram")
flow = [
    (["PM duyệt", "công việc"], PTIT_RED, WHITE),
    (["Core · outbox", "task.sync.requested"], LIGHT, DARK),
    (["integration-service", "module task-sync"], RIPT_BLUE, WHITE),
]
bw, gap, y0 = 1.9, 0.32, 1.35
for i, (lines, fill, color) in enumerate(flow):
    x = 0.45 + i * (bw + gap)
    d.rect(s, x, y0, bw, 1.0, fill=fill, line=None if fill != LIGHT else RIPT_BLUE)
    d.text(s, x, y0, bw, 1.0, lines, size=12, bold=True, color=color, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    d.text(s, x + bw, y0, gap, 1.0, "→", size=18, bold=True, color=PTIT_RED, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
xe = 0.45 + 3 * (bw + gap)
for k, label in enumerate(["Trello: tạo thẻ", "Telegram: báo tin"]):
    d.rect(s, xe, y0 + k * 0.53, 1.6, 0.47, fill=WHITE, line=RIPT_BLUE)
    d.text(s, xe, y0 + k * 0.53, 1.6, 0.47, label, size=12, bold=True, color=PTIT_RED, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
d.rect(s, 0.45, 2.55, xe + 1.6 - 0.45, 0.5, fill=LIGHT)
d.text(s, 0.55, 2.55, xe + 1.4 - 0.45, 0.5, "Trả về: task.sync.completed → Core lưu kết quả → giao diện: \"Trello\", \"Đã báo Telegram\"", size=13, color=DARK, anchor=MSO_ANCHOR.MIDDLE)
d.bullets(s, 0.45, 3.3, xe + 1.6 - 0.45, 3.6, [
    "Chỉ việc **đã duyệt** mới đẩy ra ngoài; Trello, Telegram chạy độc lập: synced / failed / skipped",
    "Chống trùng 3 lớp: processed_messages · sync_jobs khoá <id>:push:<provider> · dò thẻ có dòng **MeetingMind #id**",
    "Khoá API chỉ ở biến môi trường, không ghi vào DB, không lộ trong log",
    "Chạy thật: duyệt → thẻ Trello + tin Telegram sau **3,4 s**; 20 ca Jest đạt",
    "Giới hạn MVP: cấu hình qua .env, đồng bộ một chiều; **Jira chưa làm**",
], size=16, gap=9)
if os.path.exists(fig("fig-ui-sync")):
    # Chỉ lấy ngăn chi tiết công việc ở bên phải ảnh chụp (575 × 780 px của ảnh 2160 × 1290).
    d.cropped_image(s, fig("fig-ui-sync"), 13.0, 1.3, 5.45, (1585 / 2160, 0, 0, 1 - 780 / 1290), frame=LIGHT)

# 12. Hỏi đáp tri thức (RAG) ------------------------------------------------------
s = d.new("Hỏi đáp tri thức cuộc họp (RAG)")
d.rect(s, 0.35, 1.2, 7.8, 4.875 + 0.1, fill=LIGHT)
d.image(s, fig("fig-ui-knowledge"), 0.4, 1.25, 7.7, 4.875)
d.rect(s, 0.35, 6.3, 7.8, 0.62, fill=WHITE, line=RIPT_BLUE)
d.text(s, 0.45, 6.3, 7.6, 0.62, "Transcript · biên bản · quyết định · công việc · tài liệu → chia đoạn, nhúng → pgvector (HNSW)", size=12, color=DARK, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
d.bullets(s, 8.4, 1.3, 4.65, 5.6, [
    "Lọc quyền **trước truy xuất**: Core tính các cuộc họp người hỏi được xem, câu SQL chỉ tìm trong đó; Core kiểm lại từng trích dẫn",
    "Vietnamese_Embedding → 24 đoạn gần nhất → **rerank** bge-reranker-v2-m3 → giữ 6 đoạn",
    "GLM-5.2 chỉ trả lời từ nguồn, **bắt buộc trích dẫn [n]**; thiếu nguồn → \"chưa đủ thông tin\"",
    "Chấm 27 câu, 3 cuộc họp, 2 người dùng: **27/27**, **0 rò rỉ**; TB **1,75 s**/câu; hội thoại lưu phía máy chủ",
], size=17, gap=16)

# 13. Giao diện --------------------------------------------------------------------
s = d.new("Giao diện hệ thống")
shots = [("fig-ui-transcript", "Transcript theo người nói"), ("fig-ui-review", "Hàng đợi duyệt đề xuất AI"), ("fig-ui-minutes", "Biên bản nháp"), ("fig-ui-board", "Bảng công việc")]
for i, (name, cap) in enumerate(shots):
    x = 0.4 + (i % 2) * 6.35
    y = 1.15 + (i // 2) * 2.95
    if os.path.exists(fig(name)):
        d.rect(s, x, y, 6.2, 2.55, fill=LIGHT)
        d.image(s, fig(name), x + 0.05, y + 0.05, 6.1, 2.45)
    d.text(s, x, y + 2.55, 6.2, 0.35, cap, size=13, color=GREY, align=PP_ALIGN.CENTER, italic=True)

# 12. Thiết lập thực nghiệm ------------------------------------------------------------
s = d.new("Thiết lập thực nghiệm")
d.bullets(s, 0.6, 1.3, 6.4, 5.6, [
    "Kịch bản họp sprint **30 lượt lời, 4 người**, có đáp án: 8 công việc, 2 quyết định, 3 vấn đề mở",
    "**7 bẫy**: đề xuất chưa chốt, đính chính hạn 15→18/11, đổi người làm, chuyện bóng đá, người nói chưa có tên…",
    "Âm thanh tổng hợp bằng **FPT.AI-VITs**, mỗi người một giọng, 151 s",
    "6 điều kiện: sạch, nhiễu trắng 20/10/5 dB, đông người 10 dB, nói chồng + đoạn chỉ có nhiễu",
    "Chạy trong **đúng container ai-worker**, laptop i7-10750H, **không GPU**",
], size=16, gap=8)
d.table(s, 7.3, 1.4, 5.6, [
    ["Độ đo", "Ý nghĩa"],
    ["WER / CER", "Lỗi từ / ký tự (chuẩn hoá số)"],
    ["Thuật ngữ đúng", "Trên 24 lần xuất hiện"],
    ["Độ đúng người nói", "Theo thời lượng, ghép tối ưu"],
    ["Điểm trích xuất", "15 tiêu chí, trừ điểm bẫy"],
    ["RTF, chi phí", "Thời gian xử lý / thời lượng"],
], col_w=[2.2, 3.4], size=14, row_h=0.55)

# 15. Kết quả STT ---------------------------------------------------------------------
s = d.new("Kết quả nhận dạng tiếng nói và tách người nói")
d.image(s, fig("fig-wer"), 0.3, 1.15, 8.3, 4.2)
sc = run("small", "clean")
md = run("medium", "clean")
hw = run("small+hotwords", "clean")
d.bullets(s, 8.8, 1.3, 4.3, 4.2, [
    f"Whisper small: WER **{pct(sc['wer_num'])}%** (sạch) → {pct(run('small', 'white_snr5')['wer_num'])}% (nhiễu 5 dB)",
    f"Whisper medium: WER **{pct(md['wer_num'])}%** nhưng chậm ~2,7 lần",
    f"Từ điển thuật ngữ: thuật ngữ đúng **{sc['terms']} → {hw['terms']}**",
    "Lỗi chính: thuật ngữ tiếng Anh, dấu thanh",
], size=15, gap=7)
d.table(s, 0.5, 5.5, 12.3, [
    ["Tách người nói", "Sạch", "Nhiễu 20 dB", "Nhiễu 10 dB", "Nhiễu 5 dB", "Đông người", "Nói chồng"],
    ["Số người tìm được / 4"] + [run("small", v)["speakers"].split("/")[0] for v in ("clean", "white_snr20", "white_snr10", "white_snr5", "babble_snr10", "overlap")],
    ["Độ đúng người nói (%)"] + [pct(run("small", v)["speaker_acc"]) for v in ("clean", "white_snr20", "white_snr10", "white_snr5", "babble_snr10", "overlap")],
], col_w=[2.8, 1.5, 1.6, 1.6, 1.6, 1.6, 1.6], size=13, row_h=0.42)

# 16. LLM -------------------------------------------------------------------------------
s = d.new("Lựa chọn mô hình ngôn ngữ lớn (LLM)")
d.image(s, fig("fig-llm-models"), 0.3, 1.15, 8.9, 3.6)
best = LLM[0]
glm = next(r for r in LLM if r["model"] == "GLM-5.2")
d.bullets(s, 9.35, 1.3, 3.8, 3.6, [
    f"**{best['model']}**: 15/15 ở cả 3 lần, ~{best['seconds']:.0f} s, ~{best['cost']:.3f} USD/lần",
    f"**GLM-5.2**: {glm['mean']:.1f}/15, ~{glm['seconds']:.0f} s → dự phòng",
    "Cả hai do FPT tự vận hành: dữ liệu không ra nước ngoài",
], size=15, gap=8)
d.rect(s, 0.5, 4.95, 12.3, 1.9, fill=LIGHT)
d.text(s, 0.7, 5.0, 11.9, 1.8, [
    "**Phát hiện khi tích hợp**",
    "Bật chế độ ép JSON (response_format) → DeepSeek-V4.1-Flash trả nội dung rỗng ⇒ hệ thống tự bóc và kiểm tra JSON",
    "Mô hình suy luận quá lâu → cổng dịch vụ trả lỗi hết giờ (HTTP 524) ⇒ mô hình dự phòng tự đỡ; đã chuyển sang gọi theo luồng (streaming)",
], size=15, color=DARK)

# 17. Đầu-cuối --------------------------------------------------------------------------
s = d.new("Đánh giá đầu-cuối: âm thanh → công việc")
rows = [["Transcript đầu vào", "Nhãn tự động", "Đã gán tên"], ["Transcript chuẩn (đối chứng)", "—", "15 / 15"]]
for model, variant, label in [("small", "clean", "Whisper small · sạch"), ("medium", "clean", "Whisper medium · sạch"), ("small", "white_snr10", "small · nhiễu 10 dB"), ("medium", "white_snr10", "medium · nhiễu 10 dB"), ("small+hotwords", "white_snr10", "small + từ điển · nhiễu 10 dB"), ("small", "babble_snr10", "small · đông người"), ("small", "white_snr5", "small · nhiễu 5 dB (GLM dự phòng)")]:
    r = run(model, variant)
    if r:
        rows.append([label, str(r["llm_generic"]), str(r["llm_named"])])
d.table(s, 0.5, 1.35, 6.6, rows, col_w=[3.6, 1.5, 1.5], size=14, row_h=0.5)
d.bullets(s, 7.4, 1.35, 5.6, 5.4, [
    "Lỗi nhận dạng **lan sang** bước trích xuất (ví dụ \"cuối tuần này\" → \"cuối tôm nay\" làm mất hạn)",
    "LLM **tự sửa** nhiều lỗi nhờ ngữ cảnh: \"so gơ\" → Swagger, \"phai bây sơ\" → Firebase",
    "**Gán tên người nói** trước khi phân tích tăng điểm rõ rệt",
    "STT tốt hơn (medium) → trích xuất đạt lại **15/15**",
    "⇒ Con người rà soát là bắt buộc; hàng đợi duyệt có câu trích dẫn giúp rà soát nhanh",
], size=15, gap=8)

# 18. Thời gian ---------------------------------------------------------------------------
s = d.new("Thời gian xử lý, chi phí và hiệu quả")
d.image(s, fig("fig-timing"), 0.3, 1.15, 8.0, 3.1)
d.bullets(s, 8.5, 1.3, 4.6, 3.1, [
    f"Bản ghi 151 s: phiên âm {sc['stt_s']:.0f} s + tách người nói {sc['diar_s']:.0f} s (RTF **{str(sc['rtf']).replace('.', ',')}**) + LLM ~{sc['llm_named_s']:.0f} s",
    "Chạy nền, bất đồng bộ; không cần GPU",
    "Chi phí LLM ≈ **0,005 USD** / cuộc họp thử",
], size=15, gap=8)
d.table(s, 0.5, 4.45, 12.3, [
    ["Cuộc họp 60 phút (ước tính, chưa đo trên người dùng)", "Không có hệ thống", "Có MeetingMind"],
    ["Ghi chép trong họp", "1 người ghi liên tục", "Không cần"],
    ["Soạn biên bản + tạo, giao công việc", "~40 phút", "~10 phút rà soát, duyệt"],
    ["Tiết kiệm", "", "~30 phút / cuộc họp"],
], col_w=[5.3, 3.4, 3.6], size=14, row_h=0.5)

# 19. Đối chiếu đề cương --------------------------------------------------------------------
s = d.new("Đối chiếu kết quả với đề cương")
ok, part, no = ("Đạt", GREEN), ("Một phần", RIPT_BLUE), ("Chưa đạt", RED)
d.table(s, 0.4, 1.3, 12.5, [
    ["Nội dung", "Kết quả cần đạt", "Kết quả thực tế", "Đánh giá"],
    ["1. Tổng quan", "Tổng quan; chọn mô hình AI, nền tảng đích", "Tổng quan STT, tách người nói, LLM, kiến trúc, tích hợp", ok],
    ["2. Phân tích, thiết kế", "SRS, kiến trúc, CSDL, luồng Audio → Task", "Đặc tả 15 mục, kiến trúc hướng sự kiện, 43 bảng, 54 quyền", ok],
    ["3. Âm thanh & STT", "API xử lý âm thanh, STT ổn định tiếng Việt", "3 đường thu nhận, Whisper 2 lượt, tách người nói; WER 21,7% (small)", ok],
    ["4. AI Agent & đồng bộ", "Biên bản tự động; Jira/Trello; Telegram", "Agent LLM + hàng đợi duyệt; Trello + Telegram đã chạy (Jira chưa); bổ sung hỏi đáp RAG", ok],
    ["5. Kiểm thử, báo cáo", "Đánh giá độ chính xác, thời gian", "6 điều kiện âm thanh, 9 LLM, đầu-cuối; thời gian tiết kiệm mới ước tính", ok],
    ["6. Nghiệm thu", "Demo ổn định", "Hệ thống chạy trọn luồng trên Docker Compose", ("Sẵn sàng", RIPT_BLUE)],
], col_w=[2.1, 3.6, 5.2, 1.6], size=13, row_h=0.72)

# 20. Kết luận ------------------------------------------------------------------------------------
s = d.new("Kết luận")
d.text(s, 0.6, 1.3, 6, 0.5, "Đã đạt được", size=21, bold=True, color=GREEN)
d.bullets(s, 0.6, 1.85, 6.1, 5.0, [
    "Hệ thống chạy **trọn chuỗi** âm thanh → transcript → biên bản → công việc đã duyệt",
    "3 đường thu nhận, phiên âm đa ngôn ngữ theo đoạn, tách người nói trên CPU",
    "LLM trích xuất **15/15** trên transcript chuẩn, chi phí không đáng kể",
    "AI chỉ đề xuất, **con người duyệt**, dữ liệu lưu theo phiên bản",
    "Việc đã duyệt tự đẩy sang **Trello**, báo **Telegram**",
    "Hỏi đáp tri thức có trích nguồn, lọc quyền: **27/27** câu, không rò rỉ",
    "Quy trình đánh giá **tự động, chạy lại được**",
], size=18, gap=9)
d.text(s, 7.0, 1.3, 6, 0.5, "Hạn chế", size=21, bold=True, color=RED)
d.bullets(s, 7.0, 1.85, 5.9, 5.0, [
    "STT nhỏ trên CPU còn sai thuật ngữ tiếng Anh, dấu thanh",
    "Đánh dấu nói chồng **chưa tin cậy** (báo nhầm)",
    "Chưa có Jira; kết nối Trello/Telegram cấu hình qua biến môi trường",
    "Dữ liệu thử dựng bằng giọng tổng hợp; thời gian tiết kiệm mới ước tính",
    "Hỏi đáp chưa đánh giá trên kho cuộc họp thật quy mô lớn",
], size=18, gap=9)

# 21. Hướng phát triển ------------------------------------------------------------------------------
s = d.new("Hướng phát triển")
steps = [
    ("1", "Kết nối OAuth theo workspace, đồng bộ hai chiều, Jira", "Màn hình kết nối và chọn bảng theo workspace; cập nhật trạng thái qua webhook; thêm Jira"),
    ("2", "Nâng chất lượng nhận dạng", "Whisper lớn trên GPU, bản tinh chỉnh tiếng Việt, từ điển thuật ngữ theo dự án"),
    ("3", "Phát hiện nói chồng, nhận diện giọng đã đăng ký", "Mô hình chuyên dụng thay ngưỡng tương đối; gán tên một lần dùng lại"),
    ("4", "Đánh giá hỏi đáp trên kho cuộc họp thật", "Người chấm, chấm từng trích dẫn; OCR khử nghiêng, chữ viết tay"),
    ("5", "Đánh giá trên cuộc họp thật", "Đo thời gian rà soát biên bản trên người dùng thật"),
]
for i, (n, title, desc) in enumerate(steps):
    y = 1.35 + i * 1.08
    d.rect(s, 0.6, y, 0.75, 0.85, fill=RIPT_BLUE if i == 0 else PTIT_RED)
    d.text(s, 0.6, y, 0.75, 0.85, n, size=24, bold=True, color=WHITE, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    d.text(s, 1.55, y, 11.2, 0.45, title, size=19, bold=True, color=PTIT_RED)
    d.text(s, 1.55, y + 0.42, 11.2, 0.45, desc, size=15, color=GREY)

# 22. Cảm ơn (cùng kiểu bìa) ------------------------------------------------------------------
s = d.cover()
d.text(s, 0.8, 2.2, 11.7, 1.0, "XIN CẢM ƠN HỘI ĐỒNG ĐÃ LẮNG NGHE!", size=40, bold=True, color=BLACK, align=PP_ALIGN.CENTER, font=TITLE_FONT)
d.text(s, 0.8, 3.35, 11.7, 0.6, "Phần trình diễn hệ thống MeetingMind và hỏi đáp", size=22, color=PTIT_RED, align=PP_ALIGN.CENTER, font=TITLE_FONT)
d.text(s, 7.2, 5.7, 5.9, 1.4, ["Trần Đức Định  ·  Hoàng Nguyễn Trà My", "GVHD: TS. Lê Văn Hoàng"], size=20, color=BLACK, font=TITLE_FONT)

path = os.path.join(OUT, "SlideNghiemThu_18-SV-2026-RIPT.pptx")
d.save(path)
subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", OUT, path], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print(d.count, "slide →", path)
