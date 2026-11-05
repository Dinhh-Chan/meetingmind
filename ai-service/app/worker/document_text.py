"""Tách chữ từ tài liệu tải lên (txt, md, pdf, docx) để lập chỉ mục hỏi đáp.

Đoạn văn trả về cách nhau bằng dòng trống, vì bộ cắt đoạn ưu tiên ranh giới
đoạn văn. PDF scan (chỉ có ảnh) không có lớp chữ nên ra chuỗi rỗng: chưa OCR.
"""

from pathlib import Path

TEXT_EXTENSIONS = {".txt", ".md", ".markdown"}
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


class UnsupportedDocument(ValueError):
    """Định dạng chưa tách chữ được (vd. .doc nhị phân cũ, ảnh)."""


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
    mime = (mimetype or "").split(";")[0].strip().lower()
    if mime in ("text/plain", "text/markdown", "text/x-markdown"):
        return "text"
    if mime == "application/pdf":
        return "pdf"
    if mime == DOCX_MIME:
        return "docx"
    raise UnsupportedDocument(f"chưa hỗ trợ tách chữ cho {file_name or '?'} ({mimetype or '?'})")


def extract_text(path: Path, file_name: str = "", mimetype: str | None = None) -> str:
    kind = document_kind(file_name or path.name, mimetype)
    if kind == "text":
        # utf-8-sig bỏ BOM mà Notepad trên Windows hay thêm vào đầu file.
        return path.read_text(encoding="utf-8-sig", errors="replace")
    if kind == "pdf":
        return _pdf_text(path)
    return _docx_text(path)


def _pdf_text(path: Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    if reader.is_encrypted:
        # Nhiều PDF chỉ "khoá" quyền in/sửa với mật khẩu rỗng; mở được thì đọc.
        reader.decrypt("")
    pages = [(page.extract_text() or "").strip() for page in reader.pages]
    return "\n\n".join(p for p in pages if p)


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
