# Nguồn của hồ sơ nghiệm thu

Các tệp .docx/.pdf/.pptx ở thư mục cha được dựng từ đây.

- `content/*.md`: nội dung (cú pháp trong `SPEC.md`); `00`–`05` là quyển tổng kết, `nd1`–`nd5` là báo cáo nội dung (ghép mục bằng `::include`), `thuyet-minh.md` là thuyết minh sản phẩm.
- `figures/`: hình (PNG); `figures/src/*.html` là nguồn sơ đồ, dựng lại bằng `figures/src/render.py`.
- `references.json`, `abbreviations.json`: tài liệu tham khảo, từ viết tắt.
- `mau/mau-slide-ptit.pptx`: mẫu trình bày của Học viện (logo PTIT, Viện KHKT Bưu điện, chân trang #MakeInPTIT); `build_slides.py` dựng slide trên mẫu này.

Dựng lại (cần python-docx, python-pptx, matplotlib, pillow, playwright; LibreOffice để xuất PDF):

```bash
python build_docx.py report        # quyển tổng kết → out/
python build_docx.py content       # 5 báo cáo nội dung
python build_docx.py brief         # thuyết minh sản phẩm
python build_slides.py             # slide
```
