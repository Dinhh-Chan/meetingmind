"""Các khối dựng slide 16:9 dùng chung cho bài trình bày nghiệm thu."""

import os

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Pt

NAVY = RGBColor(0x1F, 0x3A, 0x5F)
BLUE = RGBColor(0x2E, 0x6D, 0xA4)
LIGHT = RGBColor(0xE8, 0xF0, 0xF8)
ORANGE = RGBColor(0xD9, 0x82, 0x2B)
GREY = RGBColor(0x6B, 0x72, 0x80)
DARK = RGBColor(0x1F, 0x29, 0x37)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GREEN = RGBColor(0x2F, 0x85, 0x5A)
RED = RGBColor(0xB4, 0x3C, 0x3C)

FONT = "Arial"
W, H = Emu(12192000), Emu(6858000)  # 13.333 x 7.5 in
IN = 914400


def inch(x: float) -> Emu:
    return Emu(int(x * IN))


class Deck:
    def __init__(self, footer: str):
        self.prs = Presentation()
        self.prs.slide_width, self.prs.slide_height = W, H
        self.blank = self.prs.slide_layouts[6]
        self.footer = footer
        self.count = 0

    # -------------------------------------------------------------- primitives

    def text(self, slide, x, y, w, h, text, size=18, bold=False, color=DARK, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, italic=False):
        box = slide.shapes.add_textbox(inch(x), inch(y), inch(w), inch(h))
        tf = box.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = anchor
        tf.margin_left = tf.margin_right = inch(0.05)
        lines = text if isinstance(text, list) else [text]
        for i, line in enumerate(lines):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = align
            self._runs(p, line, size, bold, color, italic)
        return box

    def _runs(self, p, line, size, bold, color, italic=False):
        # **đậm** trong dòng
        parts = line.split("**")
        for k, part in enumerate(parts):
            if not part:
                continue
            r = p.add_run()
            r.text = part
            r.font.name = FONT
            r.font.size = Pt(size)
            r.font.bold = bold or (k % 2 == 1)
            r.font.italic = italic
            r.font.color.rgb = ORANGE if (k % 2 == 1 and not bold) else color

    def bullets(self, slide, x, y, w, h, items, size=18, color=DARK, gap=6):
        box = slide.shapes.add_textbox(inch(x), inch(y), inch(w), inch(h))
        tf = box.text_frame
        tf.word_wrap = True
        first = True
        for item in items:
            level = 0
            if item.startswith("  "):
                level, item = 1, item.strip()
            p = tf.paragraphs[0] if first else tf.add_paragraph()
            first = False
            p.space_after = Pt(gap)
            marker = "▪ " if level == 0 else "– "
            r = p.add_run()
            r.text = ("      " if level else "") + marker
            r.font.name = FONT
            r.font.size = Pt(size - 2 * level)
            r.font.color.rgb = BLUE if level == 0 else GREY
            r.font.bold = True
            self._runs(p, item, size - 2 * level, False, color)
        return box

    def rect(self, slide, x, y, w, h, fill=LIGHT, line=None, shape=MSO_SHAPE.RECTANGLE):
        s = slide.shapes.add_shape(shape, inch(x), inch(y), inch(w), inch(h))
        s.fill.solid()
        s.fill.fore_color.rgb = fill
        if line is None:
            s.line.fill.background()
        else:
            s.line.color.rgb = line
            s.line.width = Pt(1.25)
        s.shadow.inherit = False
        return s

    def image(self, slide, path, x, y, w=None, h=None):
        """Chèn ảnh vừa khung (giữ tỷ lệ), căn giữa trong khung."""
        from PIL import Image

        iw, ih = Image.open(path).size
        if w and h:
            scale = min(w / iw, h / ih)
            pw, ph = iw * scale, ih * scale
            return slide.shapes.add_picture(path, inch(x + (w - pw) / 2), inch(y + (h - ph) / 2), inch(pw), inch(ph))
        if w:
            return slide.shapes.add_picture(path, inch(x), inch(y), width=inch(w))
        return slide.shapes.add_picture(path, inch(x), inch(y), height=inch(h))

    def table(self, slide, x, y, w, rows, col_w=None, size=13, header_fill=NAVY, row_h=0.4):
        nr, nc = len(rows), len(rows[0])
        shape = slide.shapes.add_table(nr, nc, inch(x), inch(y), inch(w), inch(row_h * nr))
        t = shape.table
        if col_w:
            total = sum(col_w)
            for i, cw in enumerate(col_w):
                t.columns[i].width = inch(w * cw / total)
        for ri, row in enumerate(rows):
            for ci, val in enumerate(row):
                cell = t.cell(ri, ci)
                cell.margin_left = cell.margin_right = inch(0.08)
                cell.margin_top = cell.margin_bottom = inch(0.04)
                tf = cell.text_frame
                tf.word_wrap = True
                p = tf.paragraphs[0]
                color = WHITE if ri == 0 else DARK
                if ri > 0 and isinstance(val, tuple):
                    val, color = val
                self._runs(p, str(val), size, ri == 0, color)
                cell.fill.solid()
                cell.fill.fore_color.rgb = header_fill if ri == 0 else (LIGHT if ri % 2 == 0 else WHITE)
        return t

    # -------------------------------------------------------------- slide kinds

    def new(self, title: str | None, section: str | None = None):
        slide = self.prs.slides.add_slide(self.blank)
        self.count += 1
        if title:
            self.rect(slide, 0, 0, 13.333, 0.95, fill=NAVY)
            self.rect(slide, 0, 0.95, 13.333, 0.06, fill=ORANGE)
            self.text(slide, 0.45, 0.12, 11.2, 0.75, title, size=27, bold=True, color=WHITE, anchor=MSO_ANCHOR.MIDDLE)
            if section:
                self.text(slide, 10.2, 0.2, 2.9, 0.6, section, size=12, color=RGBColor(0xC9, 0xD6, 0xE8), align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)
            # chân trang
            self.text(slide, 0.45, 7.05, 10, 0.35, self.footer, size=10, color=GREY)
            self.text(slide, 12.2, 7.05, 0.7, 0.35, str(self.count), size=11, bold=True, color=NAVY, align=PP_ALIGN.RIGHT)
        return slide

    def save(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.prs.save(path)
