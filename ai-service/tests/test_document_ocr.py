"""OCR tài liệu scan và ảnh: ảnh tiếng Việt đọc được, PDF chỉ OCR trang thiếu chữ.

Test gọi Tesseract thật cần binary tesseract (gói vie) và pdftoppm; chạy ngoài
container thiếu chúng thì bỏ qua. Test chọn trang chỉ thay hàm OCR bằng bản
ghi lại, không cần binary nào.
"""

import shutil
import subprocess
import unicodedata
from pathlib import Path

import pytest

from app.worker import document_text
from app.worker.document_text import OcrUnavailable, UnsupportedDocument, document_kind, extract_text

LINES = ["Biên bản họp dự án MeetingMind", "Hùng phụ trách thông báo nhắc lịch", "Hạn hoàn thành ngày 18 tháng 11"]
TEXT_LAYER = "Bien ban hop du an MeetingMind: Lan chot dung PostgreSQL va pgvector cho hoi dap."


def _has_vietnamese_tesseract() -> bool:
    if not shutil.which("tesseract"):
        return False
    langs = subprocess.run(["tesseract", "--list-langs"], capture_output=True, text=True).stdout.split()
    return "vie" in langs


needs_tesseract = pytest.mark.skipif(not _has_vietnamese_tesseract(), reason="cần tesseract kèm gói tiếng Việt")
needs_poppler = pytest.mark.skipif(not shutil.which("pdftoppm"), reason="cần pdftoppm (poppler-utils)")


def _norm(text: str) -> str:
    return " ".join(unicodedata.normalize("NFC", text).lower().split())


def scanned_image():
    """Ảnh trang giấy có chữ tiếng Việt, vẽ bằng font hỗ trợ dấu (DejaVu Sans)."""
    image_mod = pytest.importorskip("PIL.Image")
    from PIL import ImageDraw, ImageFont

    found = ""
    if shutil.which("fc-match"):
        found = subprocess.run(["fc-match", "-f", "%{file}", "DejaVu Sans"], capture_output=True, text=True).stdout.strip()
    font_path = next((p for p in (found, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf") if p and Path(p).exists()), None)
    if not font_path:
        pytest.skip("không có font hỗ trợ tiếng Việt")
    font = ImageFont.truetype(font_path, 40)
    image = image_mod.new("RGB", (1300, 380), "white")
    draw = ImageDraw.Draw(image)
    for i, line in enumerate(LINES):
        draw.text((50, 50 + i * 100), line, fill="black", font=font)
    return image


def text_pdf(path: Path, text: str) -> Path:
    """PDF một trang có lớp chữ thật (Helvetica), dựng tay để khỏi cần thư viện vẽ PDF."""
    stream = f"BT /F1 12 Tf 50 720 Td ({text}) Tj ET".encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, 1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets)
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n".encode() + b"%%EOF\n"
    path.write_bytes(bytes(out))
    return path


def mixed_pdf(tmp_path: Path, blank_pages: int) -> Path:
    """Trang 1 có lớp chữ, các trang sau trắng (như trang scan chưa có lớp chữ)."""
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.append(str(text_pdf(tmp_path / "text.pdf", TEXT_LAYER)))
    for _ in range(blank_pages):
        writer.add_blank_page(612, 792)
    path = tmp_path / "mixed.pdf"
    with open(path, "wb") as handle:
        writer.write(handle)
    return path


def spy_ocr(monkeypatch, result="Chữ đọc từ trang scan bằng OCR, đủ dài để thay lớp chữ rỗng."):
    pages: list[int] = []

    def fake(path, page):
        pages.append(page)
        return result

    monkeypatch.setattr(document_text, "ocr_pdf_page", fake)
    return pages


# ---------- chọn trang cần OCR (không cần binary) ----------


def test_document_kind_accepts_images():
    assert document_kind("bien-ban.PNG") == "image"
    assert document_kind("anh.jpeg") == document_kind("anh.jpg") == document_kind("anh.webp") == "image"
    assert document_kind("upload", "image/webp") == "image"
    assert document_kind("upload", "image/jpeg; charset=binary") == "image"
    with pytest.raises(UnsupportedDocument):
        document_kind("so-do.svg", "image/svg+xml")


def test_text_pages_are_not_ocrd(tmp_path, monkeypatch):
    pages = spy_ocr(monkeypatch)
    text = extract_text(mixed_pdf(tmp_path, blank_pages=1), "mixed.pdf", "application/pdf")
    assert pages == [2]  # chỉ trang trắng
    assert TEXT_LAYER in text and "Chữ đọc từ trang scan" in text

    pages.clear()
    assert extract_text(text_pdf(tmp_path / "only-text.pdf", TEXT_LAYER), "only-text.pdf") == TEXT_LAYER
    assert pages == []


def test_ocr_page_cap_and_missing_binary(tmp_path, monkeypatch):
    pages = spy_ocr(monkeypatch)
    monkeypatch.setenv("AI_OCR_MAX_PAGES", "2")
    extract_text(mixed_pdf(tmp_path, blank_pages=4), "mixed.pdf")
    assert pages == [2, 3]

    # Thiếu tesseract: không làm hỏng cả tài liệu, giữ lớp chữ sẵn có.
    def missing(path, page):
        raise OcrUnavailable("chưa cài tesseract")

    monkeypatch.setattr(document_text, "ocr_pdf_page", missing)
    assert extract_text(mixed_pdf(tmp_path, blank_pages=2), "mixed.pdf") == TEXT_LAYER


# ---------- Tesseract thật ----------


@needs_tesseract
def test_ocr_reads_vietnamese_image(tmp_path):
    image = scanned_image()
    png = tmp_path / "bien-ban.png"
    image.save(png)
    text = _norm(extract_text(png, "bien-ban.png", "image/png"))
    for word in ("meetingmind", "hùng", "thông báo", "nhắc lịch", "hạn hoàn thành", "18"):
        assert word in text, (word, text)

    # webp nhận theo mimetype; ảnh nền trong suốt (mọi điểm ảnh đều màu đen,
    # chỉ alpha phân biệt chữ) vẫn đọc được chữ.
    from PIL import Image

    rgba = Image.new("RGBA", image.size, (0, 0, 0, 0))
    rgba.putalpha(image.convert("L").point(lambda v: 255 if v < 128 else 0))
    webp = tmp_path / "upload"
    rgba.save(webp, "WEBP", lossless=True)
    assert "nhắc lịch" in _norm(extract_text(webp, "upload", "image/webp"))


@needs_tesseract
@needs_poppler
def test_scanned_pdf_falls_back_to_ocr(tmp_path, monkeypatch):
    pdf = tmp_path / "scan.pdf"
    scanned_image().save(pdf, "PDF", resolution=150)
    pages: list[int] = []
    real = document_text.ocr_pdf_page
    monkeypatch.setattr(document_text, "ocr_pdf_page", lambda path, page: pages.append(page) or real(path, page))

    text = _norm(extract_text(pdf, "scan.pdf", "application/pdf"))
    assert pages == [1]
    for word in ("meetingmind", "hùng", "nhắc lịch"):
        assert word in text, (word, text)
