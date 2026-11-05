"""Tách chữ từ tài liệu tải lên (txt, md, pdf, docx, ảnh) để lập chỉ mục hỏi đáp.

Đoạn văn trả về cách nhau bằng dòng trống, vì bộ cắt đoạn ưu tiên ranh giới
đoạn văn.

PDF scan và ảnh chụp không có lớp chữ nên phải OCR bằng Tesseract (gói
tesseract-ocr-vie) chạy ngay trong container: tài liệu nội bộ không gửi ra
dịch vụ OCR bên ngoài. PDF vẫn đọc lớp chữ từng trang trước, chỉ trang nào
gần như không có chữ mới được rasterize (pdftoppm) rồi OCR, vì OCR chậm (vài
giây mỗi trang) và kém chính xác hơn lớp chữ sẵn có.
"""

import logging
import os
import re
import shutil
import subprocess
import tempfile
import unicodedata
from pathlib import Path

log = logging.getLogger("app.knowledge")

TEXT_EXTENSIONS = {".txt", ".md", ".markdown"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
IMAGE_MIMES = {"image/png", "image/jpeg", "image/jpg", "image/pjpeg", "image/webp"}
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

OCR_LANG = "vie+eng"  # tài liệu tiếng Việt hay chen thuật ngữ tiếng Anh
OCR_DPI = 200  # đủ nét cho chữ cỡ 10pt, ảnh trang A4 chưa tới 2 MB
OCR_TIMEOUT_S = 120  # mỗi trang/ảnh; trang lỗi không được treo cả lượt lập chỉ mục
# Trang ít hơn ngần này ký tự (không tính khoảng trắng) coi như trang scan:
# lớp chữ khi đó thường chỉ còn số trang hay dòng watermark.
OCR_MIN_CHARS = 40


class UnsupportedDocument(ValueError):
    """Định dạng chưa tách chữ được (vd. .doc nhị phân cũ)."""


class OcrError(RuntimeError):
    """OCR một trang/ảnh thất bại."""


class OcrUnavailable(OcrError):
    """Thiếu tesseract/pdftoppm: mọi trang sau cũng sẽ hỏng, khỏi thử tiếp."""


def ocr_max_pages() -> int:
    # Đọc env mỗi lần: tài liệu vài trăm trang scan sẽ chiếm worker hàng chục phút.
    return max(0, int(os.environ.get("AI_OCR_MAX_PAGES", "50")))


def document_kind(file_name: str, mimetype: str | None = None) -> str:
    # Đuôi file đáng tin hơn mimetype: trình duyệt hay gửi
    # application/octet-stream cho .md.
    suffix = Path(file_name or "").suffix.lower()
    if suffix in TEXT_EXTENSIONS:
        return "text"
    if suffix == ".pdf":
        return "pdf"
    if suffix == ".docx":
        return "docx"
    if suffix in IMAGE_EXTENSIONS:
        return "image"
    mime = (mimetype or "").split(";")[0].strip().lower()
    if mime in ("text/plain", "text/markdown", "text/x-markdown"):
        return "text"
    if mime == "application/pdf":
        return "pdf"
    if mime == DOCX_MIME:
        return "docx"
    if mime in IMAGE_MIMES:
        return "image"
    raise UnsupportedDocument(f"chưa hỗ trợ tách chữ cho {file_name or '?'} ({mimetype or '?'})")


def extract_text(path: Path, file_name: str = "", mimetype: str | None = None) -> str:
    kind = document_kind(file_name or path.name, mimetype)
    if kind == "text":
        # utf-8-sig bỏ BOM mà Notepad trên Windows hay thêm vào đầu file.
        return path.read_text(encoding="utf-8-sig", errors="replace")
    if kind == "pdf":
        return _pdf_text(path, file_name or path.name)
    if kind == "image":
        text = ocr_image(path)
        log.info("OCR ảnh %s: %d ký tự", file_name or path.name, _visible(text))
        return text
    return _docx_text(path)


def _visible(text: str) -> int:
    return sum(1 for ch in text if not ch.isspace())


def _pdf_text(path: Path, label: str) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    if reader.is_encrypted:
        # Nhiều PDF chỉ "khoá" quyền in/sửa với mật khẩu rỗng; mở được thì đọc.
        reader.decrypt("")
    pages = [(page.extract_text() or "").strip() for page in reader.pages]
    scanned = [i for i, text in enumerate(pages) if _visible(text) < OCR_MIN_CHARS]
    if scanned:
        limit = ocr_max_pages()
        done = 0
        for i in scanned[:limit]:
            try:
                text = ocr_pdf_page(path, i + 1)
            except OcrUnavailable as err:
                log.warning("Không OCR được %s, chỉ dùng lớp chữ sẵn có: %s", label, err)
                break
            except OcrError as err:
                log.warning("OCR trang %d của %s lỗi, bỏ qua trang này: %s", i + 1, label, err)
                continue
            done += 1
            # Trang có lớp chữ ngắn (tiêu đề phụ lục) mà OCR ra ít hơn thì giữ lớp chữ.
            if _visible(text) > _visible(pages[i]):
                pages[i] = text
        log.info("PDF %s: %d trang, %d trang ít chữ, đã OCR %d trang (giới hạn %d)", label, len(pages), len(scanned), done, limit)
        if len(scanned) > limit:
            log.warning("PDF %s: %d trang scan vượt giới hạn AI_OCR_MAX_PAGES=%d, không OCR", label, len(scanned) - limit, limit)
    return "\n\n".join(p for p in pages if p)


def ocr_pdf_page(path: Path, page: int) -> str:
    """Rasterize đúng một trang (đánh số từ 1) rồi OCR."""
    pdftoppm = shutil.which("pdftoppm")
    if not pdftoppm:
        raise OcrUnavailable("chưa cài pdftoppm (poppler-utils)")
    with tempfile.TemporaryDirectory(prefix="mm-ocr-") as tmp:
        out = Path(tmp) / "page"
        command = [pdftoppm, "-r", str(OCR_DPI), "-f", str(page), "-l", str(page), "-png", "-gray", "-singlefile", str(path), str(out)]
        try:
            subprocess.run(command, check=True, capture_output=True, timeout=OCR_TIMEOUT_S)
        except subprocess.CalledProcessError as err:
            raise OcrError(f"pdftoppm: {err.stderr.decode(errors='replace').strip()[:200]}") from None
        except subprocess.TimeoutExpired:
            raise OcrError(f"pdftoppm quá {OCR_TIMEOUT_S}s") from None
        return ocr_image(out.with_suffix(".png"))


def ocr_image(path: Path) -> str:
    try:
        import pytesseract
        from PIL import Image, ImageOps
    except ImportError as err:  # chạy ngoài container chưa cài đủ thư viện
        raise OcrUnavailable(f"thiếu thư viện OCR: {err.name}") from None

    try:
        with Image.open(path) as source:
            # Ảnh chụp điện thoại thường nằm ngang, chiều thật ghi trong EXIF.
            image = ImageOps.exif_transpose(source)
            if image.mode in ("RGBA", "LA", "PA") or (image.mode == "P" and "transparency" in image.info):
                # Ảnh chụp màn hình nền trong suốt: đổi thẳng sang RGB thì nền
                # thành đen, chữ đen biến mất; phải đặt lên nền trắng.
                rgba = image.convert("RGBA")
                image = Image.alpha_composite(Image.new("RGBA", rgba.size, "white"), rgba).convert("RGB")
            elif image.mode not in ("L", "RGB"):
                image = image.convert("RGB")
            text = pytesseract.image_to_string(image, lang=OCR_LANG, timeout=OCR_TIMEOUT_S)
    except pytesseract.TesseractNotFoundError:
        raise OcrUnavailable("chưa cài tesseract") from None
    except (pytesseract.TesseractError, RuntimeError) as err:
        # pytesseract báo quá giờ bằng RuntimeError trơn.
        raise OcrError(f"tesseract: {str(err)[:200]}") from None
    except (OSError, Image.DecompressionBombError) as err:
        raise OcrError(f"không đọc được ảnh: {err}") from None
    return _tidy(text)


def _tidy(text: str) -> str:
    # NFC để khớp cách tìm kiếm/chấm câu trích; Tesseract kết thúc bằng \f.
    text = unicodedata.normalize("NFC", text.replace("\f", "\n"))
    lines = [line.rstrip() for line in text.split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def _docx_text(path: Path) -> str:
    import docx

    document = docx.Document(str(path))
    parts = [p.text.strip() for p in document.paragraphs]
    # Bảng trong biên bản/đặc tả hay chứa nội dung chính (phân công, mốc hạn).
    for table in document.tables:
        for row in table.rows:
            cells = []
            for cell in row.cells:
                text = " ".join(cell.text.split())
                # Ô gộp lặp lại cùng một nội dung ở mỗi cột nó chiếm.
                if text and (not cells or cells[-1] != text):
                    cells.append(text)
            if cells:
                parts.append(" | ".join(cells))
    return "\n\n".join(p for p in parts if p)
