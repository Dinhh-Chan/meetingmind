"""Dựng file Word theo thể thức báo cáo NCKH sinh viên của Viện KHKT Bưu điện.

Nội dung viết bằng markdown rút gọn (xem SPEC.md). Script đánh số chương/mục/
bảng/hình, thay tham chiếu [[nhãn]] và trích dẫn [@khoá], dựng bìa, mục lục
(số trang lấy từ bản PDF xuất bằng LibreOffice, chạy hai lượt), danh mục bảng,
hình, từ viết tắt, tài liệu tham khảo.

  python build_docx.py report        -> out/BaoCaoTongKet_18-SV-2026-RIPT.docx/.pdf
  python build_docx.py content 1..5  -> out/BaoCaoNoiDung<N>_18-SV-2026-RIPT.docx/.pdf
"""

import copy
import json
import os
import re
import subprocess
import sys
import unicodedata

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

HERE = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.join(HERE, "content")
FIGS = os.path.join(HERE, "figures")
OUT = os.path.join(HERE, "out")

FONT = "Times New Roman"
MONO = "Liberation Mono"
SIZE = 13
LINE = 1.3
TEXT_WIDTH_CM = 21.0 - 3.0 - 2.0

TITLE = "THIẾT KẾ VÀ TRIỂN KHAI HỆ THỐNG MEET-ASSISTANT: TỰ ĐỘNG HÓA TAKE-NOTE VÀ ĐỒNG BỘ HÓA QUẢN LÝ CÔNG VIỆC"
CODE = "18-SV-2026-RIPT"
STUDENTS = [
    # Họ tên, giới tính, dân tộc, mã SV, lớp, khoa, năm thứ, số năm đào tạo, ngành
    ("Trần Đức Định", "…", "…", "B23DCCC038", "D23CCPM01", "…", "4", "…", "…"),
    ("Hoàng Nguyễn Trà My", "…", "…", "B23DCCC116", "D23CCPM02", "…", "4", "…", "…"),
]
ADVISOR = "TS. Lê Văn Hoàng"

# ---------------------------------------------------------------- tài liệu tham khảo

REFS = json.load(open(os.path.join(HERE, "references.json"), encoding="utf-8"))


def ref_sort_key(entry: str) -> str:
    base = unicodedata.normalize("NFD", entry).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]", "", base)


# ---------------------------------------------------------------- parse markdown


def parse(text: str) -> list[dict]:
    """Markdown rút gọn → danh sách khối."""
    blocks: list[dict] = []
    lines = text.splitlines()
    i = 0
    para: list[str] = []

    def flush():
        if para:
            blocks.append({"t": "p", "text": " ".join(s.strip() for s in para)})
            para.clear()

    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if not s:
            flush()
            i += 1
            continue
        if s.startswith("```"):
            flush()
            code = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code.append(lines[i])
                i += 1
            blocks.append({"t": "code", "text": "\n".join(code)})
            i += 1
            continue
        m = re.match(r"^(#{1,4})(!?)\s+(.*)$", s)
        if m:
            flush()
            blocks.append({"t": f"h{len(m.group(1))}", "text": m.group(3).strip(), "unnumbered": bool(m.group(2))})
            i += 1
            continue
        if s.startswith("::table"):
            flush()
            label, caption = [x.strip() for x in s[len("::table") :].split("|", 1)]
            rows = []
            i += 1
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
                    rows.append(cells)
                i += 1
            blocks.append({"t": "table", "label": label, "caption": caption, "rows": rows})
            continue
        if s.startswith("::figure"):
            flush()
            parts = [x.strip() for x in s[len("::figure") :].split("|")]
            width = float(parts[2]) if len(parts) > 2 and parts[2] else 15.0
            blocks.append({"t": "figure", "label": parts[0], "caption": parts[1], "width": width})
            i += 1
            continue
        if s.startswith("::include"):
            flush()
            blocks.append({"t": "include", "spec": s[len("::include") :].strip()})
            i += 1
            continue
        if s.startswith("::pagebreak"):
            flush()
            blocks.append({"t": "pagebreak"})
            i += 1
            continue
        if s.startswith(">"):
            flush()
            quote = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip()[1:].strip())
                i += 1
            blocks.append({"t": "quote", "text": " ".join(quote)})
            continue
        m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", line)
        if m and (m.group(2) in "-*" or re.fullmatch(r"\d+\.", m.group(2))):
            flush()
            level = 1 if len(m.group(1).replace("\t", "  ")) >= 2 else 0
            kind = "bullet" if m.group(2) in "-*" else "num"
            item = m.group(3)
            i += 1
            # dòng nối tiếp của cùng một mục
            while i < len(lines) and lines[i].strip() and not re.match(r"^\s*([-*]|\d+\.)\s+", lines[i]) and not lines[i].strip().startswith(("#", "::", "```", ">", "|")):
                item += " " + lines[i].strip()
                i += 1
            blocks.append({"t": kind, "text": item, "level": level, "n": m.group(2)})
            continue
        para.append(line)
        i += 1
    flush()
    return blocks


def load(name: str) -> list[dict]:
    return parse(open(os.path.join(CONTENT, name), encoding="utf-8").read())


def expand_includes(blocks: list[dict]) -> list[dict]:
    """::include file.md [mục 1,3,5] — lấy cả chương hoặc chỉ một số mục ## (đếm từ 1)."""
    out = []
    for b in blocks:
        if b["t"] != "include":
            out.append(b)
            continue
        spec = b["spec"].split()
        inc = load(spec[0])
        if len(spec) > 1:
            keep = {int(x) for x in spec[1].split(",")}
            sec, kept = 0, []
            for x in inc:
                if x["t"] == "h1":
                    kept.append(x)
                    continue
                if x["t"] == "h2":
                    sec += 1
                if sec in keep:
                    kept.append(x)
            inc = kept
        out.extend(inc)
    return out


# ---------------------------------------------------------------- đánh số


def number(blocks: list[dict]) -> dict:
    """Gán số chương/mục/bảng/hình; trả bảng nhãn → chuỗi tham chiếu."""
    labels = {}
    ch = sec = sub = 0
    unnumbered = False
    tcount = fcount = 0
    for b in blocks:
        t = b["t"]
        if t == "h1":
            unnumbered = b["unnumbered"]
            if not unnumbered:
                ch += 1
                b["num"] = f"CHƯƠNG {ch}."
            sec = sub = tcount = fcount = 0
        elif t == "h2":
            sec += 1
            sub = 0
            b["num"] = f"{sec}." if unnumbered else f"{ch}.{sec}."
        elif t == "h3":
            sub += 1
            b["num"] = f"{sec}.{sub}." if unnumbered else f"{ch}.{sec}.{sub}."
        elif t == "table":
            tcount += 1
            b["num"] = f"Bảng {ch}.{tcount}." if not unnumbered else f"Bảng {tcount}."
            labels[b["label"]] = b["num"].rstrip(".")
        elif t == "figure":
            if b["label"] in labels:
                # Hình đã có ở chương trước: không in lại, tham chiếu trỏ về hình đầu.
                b["t"] = "skip"
                continue
            fcount += 1
            b["num"] = f"Hình {ch}.{fcount}." if not unnumbered else f"Hình {fcount}."
            labels[b["label"]] = b["num"].rstrip(".")
    return labels


CITE = re.compile(r"\[(?:@[\w.-]+(?:\s*[;,]\s*)?)+\]")


def collect_citations(blocks: list[dict]) -> list[str]:
    keys = []

    def scan(text):
        for group in CITE.findall(text or ""):
            for k in re.findall(r"@([\w.-]+)", group):
                if k not in keys:
                    keys.append(k)

    for b in blocks:
        for field in ("text", "caption"):
            scan(b.get(field, ""))
        for row in b.get("rows", []):
            for cell in row:
                scan(cell)
    missing = [k for k in keys if k not in REFS]
    if missing:
        print("CẢNH BÁO: trích dẫn không có trong references.json:", missing)
    keys = [k for k in keys if k in REFS]
    return sorted(keys, key=lambda k: ref_sort_key(REFS[k]))


# ---------------------------------------------------------------- docx helpers


def set_run_font(run, name=FONT, size=None, bold=None, italic=None, color=None):
    run.font.name = name
    rpr = run._element.get_or_add_rPr()
    fonts = rpr.find(qn("w:rFonts"))
    if fonts is None:
        fonts = OxmlElement("w:rFonts")
        rpr.insert(0, fonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        fonts.set(qn(attr), name)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    if italic is not None:
        run.font.italic = italic
    if color is not None:
        run.font.color.rgb = color


def style_base(doc: Document) -> None:
    st = doc.styles["Normal"]
    st.font.name = FONT
    st.font.size = Pt(SIZE)
    rpr = st.element.get_or_add_rPr()
    fonts = rpr.find(qn("w:rFonts"))
    if fonts is None:
        fonts = OxmlElement("w:rFonts")
        rpr.insert(0, fonts)
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        fonts.set(qn(attr), FONT)
    pf = st.paragraph_format
    pf.line_spacing = LINE
    pf.space_after = Pt(4)
    pf.space_before = Pt(0)
    for name, size, bold, italic in (("Heading 1", 14, True, False), ("Heading 2", 13, True, False), ("Heading 3", 13, True, True)):
        h = doc.styles[name]
        h.font.name = FONT
        h.font.size = Pt(size)
        h.font.bold = bold
        h.font.italic = italic
        h.font.color.rgb = RGBColor(0, 0, 0)
        hr = h.element.get_or_add_rPr()
        f = hr.find(qn("w:rFonts"))
        if f is None:
            f = OxmlElement("w:rFonts")
            hr.insert(0, f)
        for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
            f.set(qn(attr), FONT)
        for attr in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
            if f.get(qn(attr)) is not None:
                del f.attrib[qn(attr)]
        h.paragraph_format.line_spacing = LINE
        h.paragraph_format.space_before = Pt(12 if name != "Heading 1" else 0)
        h.paragraph_format.space_after = Pt(6 if name != "Heading 1" else 18)
        h.paragraph_format.keep_with_next = True


def setup_section(section, fmt: str | None = None, start: int | None = None, border: bool = False, footer: bool = True):
    section.page_width, section.page_height = Cm(21.0), Cm(29.7)
    section.left_margin, section.right_margin = Cm(3.0), Cm(2.0)
    section.top_margin, section.bottom_margin = Cm(2.0), Cm(2.0)
    section.footer_distance = Cm(1.0)
    sect = section._sectPr
    for old in sect.findall(qn("w:pgNumType")):
        sect.remove(old)
    if fmt or start:
        pg = OxmlElement("w:pgNumType")
        if fmt:
            pg.set(qn("w:fmt"), fmt)
        if start:
            pg.set(qn("w:start"), str(start))
        sect.append(pg)
    for old in sect.findall(qn("w:pgBorders")):
        sect.remove(old)
    if border:
        borders = OxmlElement("w:pgBorders")
        borders.set(qn("w:offsetFrom"), "page")
        for side in ("top", "left", "bottom", "right"):
            e = OxmlElement(f"w:{side}")
            e.set(qn("w:val"), "thinThickSmallGap")
            e.set(qn("w:sz"), "24")
            e.set(qn("w:space"), "24")
            e.set(qn("w:color"), "auto")
            borders.append(e)
        # pgBorders phải đứng trước pgNumType trong sectPr
        pg = sect.find(qn("w:pgNumType"))
        if pg is not None:
            pg.addprevious(borders)
        else:
            sect.append(borders)
    section.footer.is_linked_to_previous = False
    fp = section.footer.paragraphs[0]
    for r in list(fp.runs):
        r._element.getparent().remove(r._element)
    if footer:
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_field(fp, "PAGE")


def add_field(paragraph, instr: str) -> None:
    run = paragraph.add_run()
    set_run_font(run, size=12)
    b = OxmlElement("w:fldChar")
    b.set(qn("w:fldCharType"), "begin")
    it = OxmlElement("w:instrText")
    it.set(qn("xml:space"), "preserve")
    it.text = instr
    sep = OxmlElement("w:fldChar")
    sep.set(qn("w:fldCharType"), "separate")
    t = OxmlElement("w:t")
    t.text = "1"
    e = OxmlElement("w:fldChar")
    e.set(qn("w:fldCharType"), "end")
    for x in (b, it, sep, t, e):
        run._element.append(x)


def fix_widths(table, widths_cm: list[float]) -> None:
    """LibreOffice đọc độ rộng từ tblGrid; Word đọc tcW. Ghi cả hai."""
    table.autofit = False
    tbl = table._tbl
    grid = tbl.tblGrid
    for gc, w in zip(grid.findall(qn("w:gridCol")), widths_cm):
        gc.set(qn("w:w"), str(int(w * 567)))
    for row in table.rows:
        for cell, w in zip(row.cells, widths_cm):
            cell.width = Cm(w)
    tblpr = tbl.tblPr
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    tblpr.append(layout)


INLINE = re.compile(r"(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)")


def add_inline(paragraph, text: str, size=None, bold=None, italic=None):
    for part in INLINE.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            r = paragraph.add_run(part[2:-2])
            set_run_font(r, size=size, bold=True, italic=italic)
        elif part.startswith("`") and part.endswith("`"):
            r = paragraph.add_run(part[1:-1])
            set_run_font(r, name=MONO, size=(size or SIZE) - 2, bold=bold, italic=italic)
        elif part.startswith("*") and part.endswith("*") and len(part) > 2:
            r = paragraph.add_run(part[1:-1])
            set_run_font(r, size=size, bold=bold, italic=True)
        else:
            r = paragraph.add_run(part)
            set_run_font(r, size=size, bold=bold, italic=italic)


def shade(cell_or_par, fill: str, is_cell=True):
    el = cell_or_par._tc.get_or_add_tcPr() if is_cell else cell_or_par._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), fill)
    el.append(shd)


def centered(doc, text, size=SIZE, bold=False, italic=False, before=0, after=0, upper=False):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.line_spacing = 1.15
    r = p.add_run(text.upper() if upper else text)
    set_run_font(r, size=size, bold=bold, italic=italic)
    return p


def page_break(doc):
    p = doc.add_paragraph()
    p.add_run().add_break(WD_BREAK.PAGE)


# ---------------------------------------------------------------- render


class Renderer:
    def __init__(self, doc: Document, labels: dict, cite_order: list[str]):
        self.doc = doc
        self.labels = labels
        self.cite = {k: i + 1 for i, k in enumerate(cite_order)}
        self.first_h1 = True

    def resolve(self, text: str) -> str:
        def ref(m):
            lab = m.group(1)
            if lab not in self.labels:
                print("CẢNH BÁO: tham chiếu không tồn tại:", lab)
                return lab
            return self.labels[lab]

        text = re.sub(r"\[\[([\w-]+)\]\]", ref, text)

        def cites(m):
            keys = re.findall(r"@([\w.-]+)", m.group(0))
            nums = sorted({self.cite[k] for k in keys if k in self.cite})
            return "[" + ", ".join(str(n) for n in nums) + "]" if nums else ""

        text = re.sub(r"\[(?:@[\w.-]+(?:\s*[;,]\s*)?)+\]", cites, text)
        return text

    def para(self, text, indent=True, align=WD_ALIGN_PARAGRAPH.JUSTIFY):
        p = self.doc.add_paragraph()
        p.alignment = align
        if indent:
            p.paragraph_format.first_line_indent = Cm(1.0)
        add_inline(p, self.resolve(text))
        return p

    def render(self, blocks: list[dict]):
        for b in blocks:
            getattr(self, "r_" + b["t"])(b)

    def heading(self, b, level):
        style = f"Heading {level}"
        text = b["text"]
        if level == 1:
            if not self.first_h1:
                page_break(self.doc)
            self.first_h1 = False
            label = (b.get("num", "") + " " + text).strip().upper()
            p = self.doc.add_paragraph(style=style)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        else:
            label = (b.get("num", "") + " " + text).strip()
            p = self.doc.add_paragraph(style=style)
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.first_line_indent = Cm(0)
        r = p.add_run(label)
        set_run_font(r, size=14 if level == 1 else SIZE, bold=True, italic=(level == 3), color=RGBColor(0, 0, 0))
        b["display"] = label

    def r_h1(self, b):
        self.heading(b, 1)

    def r_h2(self, b):
        self.heading(b, 2)

    def r_h3(self, b):
        self.heading(b, 3)

    def r_h4(self, b):
        p = self.doc.add_paragraph()
        p.paragraph_format.space_before = Pt(6)
        p.paragraph_format.keep_with_next = True
        add_inline(p, self.resolve(b["text"]), bold=True, italic=True)

    def r_p(self, b):
        self.para(b["text"])

    def r_quote(self, b):
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.left_indent = Cm(1.0)
        p.paragraph_format.right_indent = Cm(0.5)
        add_inline(p, self.resolve(b["text"]), italic=True)

    def list_item(self, b, marker):
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        left = 1.0 + 0.75 * b["level"]
        p.paragraph_format.left_indent = Cm(left)
        p.paragraph_format.first_line_indent = Cm(-0.6)
        p.paragraph_format.tab_stops.add_tab_stop(Cm(left))
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(marker + "\t")
        set_run_font(r)
        add_inline(p, self.resolve(b["text"]))

    def r_bullet(self, b):
        self.list_item(b, "–" if b["level"] == 0 else "+")

    def r_num(self, b):
        self.list_item(b, b["n"])

    def r_code(self, b):
        for k, line in enumerate(b["text"].split("\n")):
            p = self.doc.add_paragraph()
            p.paragraph_format.line_spacing = 1.0
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.left_indent = Cm(0.5)
            p.paragraph_format.keep_with_next = True
            shade(p, "F2F2F2", is_cell=False)
            r = p.add_run(line if line else " ")
            set_run_font(r, name=MONO, size=9.5)
        self.doc.add_paragraph().paragraph_format.space_after = Pt(0)

    def caption(self, num, text, above):
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.space_before = Pt(6 if above else 2)
        p.paragraph_format.space_after = Pt(4 if above else 10)
        p.paragraph_format.keep_with_next = above
        r = p.add_run(num + " ")
        set_run_font(r, size=12, bold=True)
        add_inline(p, self.resolve(text), size=12, italic=True)

    def r_table(self, b):
        rows = b["rows"]
        self.caption(b["num"], b["caption"], above=True)
        ncol = max(len(r) for r in rows)
        table = self.doc.add_table(rows=len(rows), cols=ncol)
        table.style = "Table Grid"
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        # Độ rộng cột theo độ dài nội dung, có sàn để cột ngắn không quá hẹp.
        lens = [max(len(self.resolve(r[c])) if c < len(r) else 0 for r in rows) for c in range(ncol)]
        # Sàn 10: cột số ngắn trừ lề ô vẫn đủ chỗ cho tiêu đề hai dòng.
        weights = [max(10, min(l, 55)) for l in lens]
        total = sum(weights)
        widths_cm = [TEXT_WIDTH_CM * w / total for w in weights]
        widths = [Cm(w) for w in widths_cm]
        for ri, row in enumerate(rows):
            for ci in range(ncol):
                cell = table.cell(ri, ci)
                cell.width = widths[ci]
                p = cell.paragraphs[0]
                p.paragraph_format.first_line_indent = Cm(0)
                p.paragraph_format.line_spacing = 1.1
                p.paragraph_format.space_after = Pt(1)
                text = self.resolve(row[ci]) if ci < len(row) else ""
                parts = text.split("<br>")
                for k, part in enumerate(parts):
                    if k:
                        p = cell.add_paragraph()
                        p.paragraph_format.first_line_indent = Cm(0)
                        p.paragraph_format.line_spacing = 1.1
                        p.paragraph_format.space_after = Pt(1)
                    add_inline(p, part, size=11.5, bold=True if ri == 0 else None)
                if ri == 0:
                    shade(cell, "D9E2F3")
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        fix_widths(table, widths_cm)
        # lặp hàng tiêu đề khi bảng sang trang
        trpr = table.rows[0]._tr.get_or_add_trPr()
        th = OxmlElement("w:tblHeader")
        th.set(qn("w:val"), "true")
        trpr.append(th)
        spacer = self.doc.add_paragraph()
        spacer.paragraph_format.space_after = Pt(4)

    def r_figure(self, b):
        path = os.path.join(FIGS, b["label"] + ".png")
        p = self.doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.first_line_indent = Cm(0)
        p.paragraph_format.keep_with_next = True
        p.paragraph_format.line_spacing = 1.0
        if os.path.exists(path):
            p.add_run().add_picture(path, width=Cm(min(b["width"], TEXT_WIDTH_CM)))
        else:
            print("CẢNH BÁO: thiếu hình", path)
            r = p.add_run(f"[Hình {b['label']} chưa có]")
            set_run_font(r, italic=True, color=RGBColor(0xC0, 0, 0))
        self.caption(b["num"], b["caption"], above=False)

    def r_skip(self, b):
        pass

    def r_pagebreak(self, b):
        page_break(self.doc)


# ---------------------------------------------------------------- front matter


def cover(doc, kind: str, subtitle: str | None = None, sub_cover=False):
    centered(doc, "HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG", 14, bold=True)
    centered(doc, "VIỆN KHOA HỌC KỸ THUẬT BƯU ĐIỆN", 14, bold=True, after=4)
    centered(doc, "─────── ✦ ───────", 12, after=40 if not sub_cover else 24)
    if kind == "report":
        centered(doc, "BÁO CÁO TỔNG KẾT", 22, bold=True, after=6)
        centered(doc, "ĐỀ TÀI NGHIÊN CỨU KHOA HỌC CỦA SINH VIÊN", 16, bold=True, after=4)
        centered(doc, "NĂM 2026", 16, bold=True, after=36 if not sub_cover else 24)
    else:
        centered(doc, "BÁO CÁO NỘI DUNG", 22, bold=True, after=10)
        centered(doc, subtitle or "", 15, bold=True, after=28)
        centered(doc, "ĐỀ TÀI NGHIÊN CỨU KHOA HỌC CỦA SINH VIÊN NĂM 2026", 13, bold=True, after=12)
    centered(doc, TITLE, 17 if kind == "report" else 15, bold=True, after=20)
    centered(doc, CODE, 15, bold=True, after=8)
    centered(doc, "Thuộc nhóm ngành khoa học: Công nghệ thông tin", 13, italic=True, after=24)
    if sub_cover:
        cols = ["Sinh viên thực hiện", "Giới tính", "Dân tộc", "Mã SV", "Lớp", "Khoa", "Năm thứ", "Số năm đào tạo", "Ngành học"]
        t = doc.add_table(rows=len(STUDENTS) + 1, cols=len(cols))
        t.style = "Table Grid"
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        widths = [3.6, 1.2, 1.1, 2.8, 2.6, 1.1, 1.0, 1.4, 1.2]
        for ci, c in enumerate(cols):
            cell = t.cell(0, ci)
            cell.width = Cm(widths[ci])
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.line_spacing = 1.0
            r = p.add_run(c)
            set_run_font(r, size=10, bold=True)
        for ri, st in enumerate(STUDENTS, 1):
            for ci, v in enumerate(st):
                cell = t.cell(ri, ci)
                cell.width = Cm(widths[ci])
                p = cell.paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.line_spacing = 1.0
                r = p.add_run(v)
                set_run_font(r, size=10.5)
        fix_widths(t, widths)
        centered(doc, "", after=8)
        p = centered(doc, "", 13, after=0)
        r = p.add_run("Người hướng dẫn: ")
        set_run_font(r, bold=True)
        r = p.add_run(ADVISOR)
        set_run_font(r)
    elif kind != "report":
        for label, value in (("Chủ trì đề tài:", "Trần Đức Định (B23DCCC038)"), ("Thành viên:", "Hoàng Nguyễn Trà My (B23DCCC116)"), ("Giảng viên hướng dẫn:", ADVISOR)):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(3.0)
            p.paragraph_format.line_spacing = 1.2
            p.paragraph_format.tab_stops.add_tab_stop(Cm(8.5))
            r = p.add_run(label + "\t")
            set_run_font(r, bold=True)
            r = p.add_run(value)
            set_run_font(r)
    # đẩy dòng "Hà Nội" xuống cuối trang
    for _ in range(3 if sub_cover else 5):
        centered(doc, "", after=10)
    centered(doc, "Hà Nội – 2026", 14, bold=True)


def toc_line(doc, text, page, level, bold=False):
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Cm(0)
    p.paragraph_format.left_indent = Cm(0.6 * level)
    p.paragraph_format.space_after = Pt(1)
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.tab_stops.add_tab_stop(Cm(TEXT_WIDTH_CM), WD_TAB_ALIGNMENT.RIGHT, WD_TAB_LEADER.DOTS)
    r = p.add_run(text + "\t" + str(page))
    set_run_font(r, size=12.5, bold=bold, italic=(level == 2))


def front_heading(doc, text):
    p = doc.add_paragraph(style="Heading 1")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(text)
    set_run_font(r, size=14, bold=True, color=RGBColor(0, 0, 0))


# ---------------------------------------------------------------- build


MAIN_FILES = ["00-mo-dau.md", "01-co-so-ly-thuyet.md", "02-phan-tich-thiet-ke.md", "03-xay-dung.md", "04-thuc-nghiem.md", "05-ket-luan.md"]


def labeled_index() -> dict:
    """Mọi hình/bảng có nhãn trong các chương của quyển tổng kết."""
    idx = {}
    for f in MAIN_FILES:
        if os.path.exists(os.path.join(CONTENT, f)):
            for b in load(f):
                if b["t"] in ("table", "figure") and b["label"] not in idx:
                    idx[b["label"]] = b
    return idx


def pull_missing(blocks: list[dict]) -> list[dict]:
    """Báo cáo nội dung chỉ ghép một phần chương: hình/bảng được nhắc tới nhưng
    nằm ở chương không ghép thì chèn ngay sau đoạn nhắc tới đầu tiên."""
    defined = {b["label"] for b in blocks if b["t"] in ("table", "figure")}
    idx = labeled_index()
    out = []
    for b in blocks:
        out.append(b)
        text = " ".join([b.get("text", "") or ""] + [c for r in b.get("rows", []) for c in r])
        for lab in re.findall(r"\[\[([\w-]+)\]\]", text):
            if lab not in defined and lab in idx:
                out.append(copy.deepcopy(idx[lab]))
                defined.add(lab)
    return out


def build(blocks: list[dict], out_name: str, kind: str, subtitle: str | None, pages: dict | None, abbrev: list | None):
    blocks = pull_missing(expand_includes(blocks))
    labels = number(blocks)
    cite_order = collect_citations(blocks)
    doc = Document()
    style_base(doc)

    # Bìa
    sec = doc.sections[0]
    setup_section(sec, border=True, footer=False)
    cover(doc, kind, subtitle)
    if kind == "report":
        s = doc.add_section(WD_SECTION.NEW_PAGE)
        setup_section(s, border=True, footer=False)
        cover(doc, kind, subtitle, sub_cover=True)

    # Phần đầu: mục lục, danh mục (số trang La Mã)
    s = doc.add_section(WD_SECTION.NEW_PAGE)
    setup_section(s, fmt="lowerRoman", start=1)
    front_heading(doc, "MỤC LỤC")
    pages = pages or {}
    heads = [b for b in blocks if b["t"] in ("h1", "h2", "h3")]
    for b in heads:
        lvl = int(b["t"][1]) - 1
        text = (b.get("num", "") + " " + b["text"]).strip()
        if b["t"] == "h1":
            text = text.upper()
        toc_line(doc, text, pages.get(("h", text), "…"), lvl, bold=(lvl == 0))
    if cite_order:
        toc_line(doc, "TÀI LIỆU THAM KHẢO", pages.get(("h", "TÀI LIỆU THAM KHẢO"), "…"), 0, bold=True)
    tables = [b for b in blocks if b["t"] == "table"]
    figures = [b for b in blocks if b["t"] == "figure"]
    if tables:
        page_break(doc)
        front_heading(doc, "DANH MỤC BẢNG BIỂU")
        for b in tables:
            toc_line(doc, f"{b['num']} {b['caption']}", pages.get(("c", b["num"]), "…"), 0)
    if figures:
        page_break(doc)
        front_heading(doc, "DANH MỤC HÌNH VẼ")
        for b in figures:
            toc_line(doc, f"{b['num']} {b['caption']}", pages.get(("c", b["num"]), "…"), 0)
    if abbrev:
        page_break(doc)
        front_heading(doc, "DANH MỤC TỪ VIẾT TẮT")
        t = doc.add_table(rows=len(abbrev) + 1, cols=3)
        t.style = "Table Grid"
        for ci, (c, w) in enumerate((("Từ viết tắt", 3.2), ("Tiếng Anh", 6.6), ("Tiếng Việt", 6.2))):
            cell = t.cell(0, ci)
            cell.width = Cm(w)
            shade(cell, "D9E2F3")
            r = cell.paragraphs[0].add_run(c)
            set_run_font(r, size=12, bold=True)
        for ri, row in enumerate(abbrev, 1):
            for ci, v in enumerate(row):
                cell = t.cell(ri, ci)
                cell.width = Cm((3.2, 6.6, 6.2)[ci])
                cell.paragraphs[0].paragraph_format.line_spacing = 1.05
                r = cell.paragraphs[0].add_run(v)
                set_run_font(r, size=12, bold=(ci == 0))
        fix_widths(t, [3.2, 6.6, 6.2])

    # Nội dung (số trang từ 1)
    s = doc.add_section(WD_SECTION.NEW_PAGE)
    setup_section(s, fmt="decimal", start=1)
    rend = Renderer(doc, labels, cite_order)
    rend.render(blocks)

    if cite_order:
        page_break(doc)
        front_heading(doc, "TÀI LIỆU THAM KHẢO")
        for i, k in enumerate(cite_order, 1):
            p = doc.add_paragraph()
            # URL dài: căn đều sẽ kéo giãn khoảng trắng, nên căn trái.
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.left_indent = Cm(1.0)
            p.paragraph_format.first_line_indent = Cm(-1.0)
            p.paragraph_format.tab_stops.add_tab_stop(Cm(1.0))
            p.paragraph_format.line_spacing = 1.2
            r = p.add_run(f"[{i}]\t")
            set_run_font(r, size=12.5)
            add_inline(p, REFS[k], size=12.5)

    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, out_name + ".docx")
    doc.save(path)
    return path, blocks


def to_pdf(docx_path: str) -> str:
    subprocess.run(
        ["soffice", "--headless", "--convert-to", "pdf", "--outdir", OUT, docx_path],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return docx_path[:-5] + ".pdf"


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", s)).strip().lower()


def page_map(pdf: str, blocks: list[dict], has_refs: bool) -> dict:
    """Tìm số trang (theo đánh số phần nội dung) của từng tiêu đề và chú thích."""
    text = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True).stdout
    pages = [norm(p) for p in text.split("\f")]
    # Trang đầu của phần nội dung: trang đầu có tiêu đề chương đầu tiên, sau các trang danh mục.
    first = next(b for b in blocks if b["t"] == "h1")
    first_text = norm((first.get("num", "") + " " + first["text"]).strip())[:30]
    start = None
    for idx, pg in enumerate(pages):
        lines = [l.strip() for l in pg.split("  ") if l.strip()]
        if pg.lstrip().startswith(first_text[:20]) and "…" not in pg[:200] and "mục lục" not in pg[:40]:
            start = idx
            break
    if start is None:
        # dự phòng: lần xuất hiện cuối cùng của tiêu đề chương đầu ở đầu trang
        cands = [i for i, pg in enumerate(pages) if first_text[:20] in pg[:120]]
        start = cands[-1] if cands else 0
    result = {}
    cur = start
    for b in blocks:
        if b["t"] in ("h1", "h2", "h3"):
            disp = (b.get("num", "") + " " + b["text"]).strip()
            key = disp.upper() if b["t"] == "h1" else disp
            needle = norm(key)[:40]
            for idx in range(cur, len(pages)):
                if needle in pages[idx]:
                    cur = idx
                    break
            result[("h", key)] = cur - start + 1
        elif b["t"] in ("table", "figure"):
            needle = norm(b["num"] + " " + b["caption"])[:30]
            for idx in range(cur, len(pages)):
                if needle in pages[idx]:
                    cur = idx
                    break
            result[("c", b["num"])] = cur - start + 1
    if has_refs:
        for idx in range(len(pages) - 1, cur - 1, -1):
            if "tài liệu tham khảo" in pages[idx][:200]:
                result[("h", "TÀI LIỆU THAM KHẢO")] = idx - start + 1
                break
    result["_body_pages"] = len(pages) - start
    return result


def make(blocks, out_name, kind, subtitle=None, abbrev=None):
    path, numbered = build(copy.deepcopy(blocks), out_name, kind, subtitle, None, abbrev)
    pdf = to_pdf(path)
    pages = page_map(pdf, numbered, has_refs=bool(collect_citations(numbered)))
    path, _ = build(copy.deepcopy(blocks), out_name, kind, subtitle, pages, abbrev)
    pdf = to_pdf(path)
    print(f"{out_name}: {pages['_body_pages']} trang nội dung (kể cả TLTK) → {pdf}")
    return path, pdf


def build_brief(md_file: str, out_name: str):
    """Thuyết minh sản phẩm: không bìa, không mục lục, tối đa 2 trang."""
    blocks = load(md_file)
    doc = Document()
    style_base(doc)
    doc.styles["Normal"].paragraph_format.line_spacing = 1.15
    doc.styles["Normal"].paragraph_format.space_after = Pt(2)
    sec = doc.sections[0]
    setup_section(sec, footer=False)
    sec.top_margin = sec.bottom_margin = Cm(1.6)
    centered(doc, "HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG – VIỆN KHOA HỌC KỸ THUẬT BƯU ĐIỆN", 11, bold=True)
    centered(doc, "THUYẾT MINH SẢN PHẨM PHẦN MỀM", 15, bold=True, before=6)
    centered(doc, f"Đề tài NCKH sinh viên năm 2026 – Mã số {CODE}", 12, italic=True)
    centered(doc, "Chủ trì: Trần Đức Định (B23DCCC038) · Thành viên: Hoàng Nguyễn Trà My (B23DCCC116) · GVHD: " + ADVISOR, 11, after=6)
    rend = Renderer(doc, {}, [])
    for b in blocks:
        if b["t"] == "h4":
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(5)
            p.paragraph_format.space_after = Pt(1)
            p.paragraph_format.keep_with_next = True
            add_inline(p, b["text"], size=12.5, bold=True)
        elif b["t"] == "p":
            p = rend.para(b["text"])
            p.paragraph_format.first_line_indent = Cm(0.7)
            for r in p.runs:
                r.font.size = Pt(12)
        else:
            getattr(rend, "r_" + b["t"])(b)
            last = doc.paragraphs[-1]
            for r in last.runs:
                r.font.size = Pt(12)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, out_name + ".docx")
    doc.save(path)
    pdf = to_pdf(path)
    pages = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout
    print(out_name, [l for l in pages.splitlines() if l.startswith("Pages")], "→", pdf)


ABBREV = json.load(open(os.path.join(HERE, "abbreviations.json"), encoding="utf-8")) if os.path.exists(os.path.join(HERE, "abbreviations.json")) else []

CONTENT_REPORTS = {
    1: ("Nội dung 1: Nghiên cứu tổng quan công nghệ STT, LLM và giao thức tích hợp", "nd1.md"),
    2: ("Nội dung 2: Phân tích và thiết kế hệ thống", "nd2.md"),
    3: ("Nội dung 3: Xây dựng module lõi xử lý âm thanh và nhận dạng tiếng nói", "nd3.md"),
    4: ("Nội dung 4: Xây dựng AI Agent tóm tắt biên bản và module đồng bộ", "nd4.md"),
    5: ("Nội dung 5: Kiểm thử, đánh giá và hoàn thiện báo cáo", "nd5.md"),
}


def main():
    what = sys.argv[1]
    if what == "report":
        files = ["00-mo-dau.md", "01-co-so-ly-thuyet.md", "02-phan-tich-thiet-ke.md", "03-xay-dung.md", "04-thuc-nghiem.md", "05-ket-luan.md"]
        blocks = []
        for f in files:
            if os.path.exists(os.path.join(CONTENT, f)):
                blocks += load(f)
            else:
                print("bỏ qua (chưa có):", f)
        if os.path.exists(os.path.join(CONTENT, "99-phu-luc.md")):
            blocks += load("99-phu-luc.md")
        make(blocks, f"BaoCaoTongKet_{CODE}", "report", abbrev=ABBREV)
    elif what == "brief":
        build_brief("thuyet-minh.md", f"ThuyetMinhSanPham_{CODE}")
    elif what == "content":
        for n in [int(x) for x in sys.argv[2:]] or CONTENT_REPORTS:
            subtitle, f = CONTENT_REPORTS[n]
            make(load(f), f"BaoCaoNoiDung{n}_{CODE}", "content", subtitle=subtitle)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
