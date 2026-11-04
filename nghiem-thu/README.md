# Hồ sơ nghiệm thu đề tài 18-SV-2026-RIPT

| Tệp | Nội dung |
| --- | --- |
| `BaoCaoTongKet_18-SV-2026-RIPT` (.docx/.pdf) | Quyển báo cáo tổng kết theo mẫu của Viện KHKT Bưu điện |
| `BaoCaoNoiDung1…5_18-SV-2026-RIPT` | Báo cáo 5 nội dung theo tiến độ trong đề cương |
| `ThuyetMinhSanPham_18-SV-2026-RIPT` | Thuyết minh sản phẩm phần mềm (2 trang A4) |
| `SlideNghiemThu_18-SV-2026-RIPT` (.pptx/.pdf) | Slide trình bày trước hội đồng |
| `thuc-nghiem/` | Tập lệnh và số liệu thô của chương Thực nghiệm và đánh giá |

Bìa phụ của quyển tổng kết còn các ô `…` (giới tính, dân tộc, khoa, số năm đào tạo, ngành) để nhóm tự điền.

## Chạy lại thực nghiệm

Số liệu trong báo cáo sinh từ các tập lệnh trong `thuc-nghiem/`, chạy trong container `ai-worker`
(thư mục chứa tập lệnh được gắn vào `/check`, kèm `llm-benchmark/bench.py` ở `/check/llm_bench`):

1. `build_dataset.py` — dựng 6 bản ghi cuộc họp 4 người bằng FPT TTS (cần `AI_LLM_API_KEY`).
2. `run_eval.py <small|medium> <điều kiện…>` — đo WER/CER, độ đúng người nói, nói chồng, thời gian;
   `EVAL_LLM=1` để chấm cả trích xuất biên bản, `EVAL_HOTWORDS=1` để bật từ điển thuật ngữ.
3. `summarize.py` — tổng hợp `ket-qua/*.json` thành `summary.json`.
4. `llm-benchmark/bench.py <model…>` — so sánh các LLM trên transcript chuẩn (`BENCH_RUNS`, `BENCH_NO_RF`).
5. `e2e_audio.py`, `verify_fixes.py` — kiểm thử đầu-cuối qua API của hệ thống đang chạy.
