"""Các khối dựng slide 16:9 dùng chung cho bài trình bày nghiệm thu, theo mẫu
trình bày của Học viện (mau/mau-slide-ptit.pptx): logo PTIT và Viện KHKT Bưu điện
ở đầu trang, chân trang #MakeInPTIT, bìa có dải đỏ."""

import io
import os

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_SHAPE_TYPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Pt

PTIT_RED = RGBColor(0xD7, 0x20, 0x27)
RIPT_BLUE = RGBColor(0x00, 0x31, 0xCB)
LIGHT = RGBColor(0xF3, 0xF4, 0xF6)
GREY = RGBColor(0x6B, 0x72, 0x80)
DARK = RGBColor(0x1F, 0x29, 0x37)
BLACK = RGBColor(0x00, 0x00, 0x00)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GREEN = RGBColor(0x2F, 0x85, 0x5A)
RED = PTIT_RED

FONT = "Calibri"  # phông nội dung của mẫu
TITLE_FONT = "Times New Roman"  # tiêu đề slide và chữ trên bìa của mẫu
IN = 914400

# Toạ độ dọc trong build_slides tính trên khung nội dung chuẩn 1,15–7,0 in. Deck co
# khung đó vào vùng trống của mẫu (dưới tiêu đề, trên chân trang) và thu nhỏ chữ
# theo, để đổi mẫu không phải sửa toạ độ từng slide.
FRAME_TOP, FRAME_BOTTOM = 1.15, 7.0
CONTENT_TOP, CONTENT_BOTTOM = 1.72, 6.8
SCALE = (CONTENT_BOTTOM - CONTENT_TOP) / (FRAME_BOTTOM - FRAME_TOP)
FONT_SCALE = 0.92

# Vị trí các hình nhận diện, lấy đúng theo slide trong mẫu (EMU).
PTIT_COVER = (299443, -45, 4265536, 1022477)
RIPT_LOGO = (7627023, 305958, 443865, 438785)
RIPT_NAME = (8169538, 306172, 2848831, 234068)
RIPT_NAME_CROP_TOP = 0.40245  # ảnh có hai dòng, mẫu chỉ hiện dòng "VIỆN KHOA HỌC KỸ THUẬT BƯU ĐIỆN"
RIPT_EN = (8070647, 495646)
# Bản PDF của mẫu cắt bớt đáy ảnh nền để dải đỏ bắt đầu ở 5,3 in.
COVER_BG_CROP_BOTTOM = 0.0747


def inch(x: float) -> Emu:
    return Emu(int(x * IN))


class Deck:
    def __init__(self, template: str):
        self.prs = Presentation(template)
        # Ảnh nền bìa và logo nằm trên slide bìa của mẫu, không nằm trong layout:
        # giữ lại ảnh rồi bỏ các slide mẫu.
        pics = {s.name: s.image.blob for s in self.prs.slides[0].shapes if s.shape_type == MSO_SHAPE_TYPE.PICTURE}
        self.cover_bg, self.ptit_logo = pics["Picture 75"], pics["Picture 76"]
        self.ript_logo, self.ript_name = pics["Picture 2"], pics["Picture 4"]
        ids = self.prs.slides._sldIdLst
        for sld in list(ids):
            ids.remove(sld)
            self.prs.part.drop_rel(sld.rId)
        layouts = {l.name: l for l in self.prs.slide_layouts}
        self.layout_cover, self.layout_blank = layouts["Title Slide"], layouts["Blank"]
        self.count = 0
        self.content = False  # slide đang dựng có dùng khung nội dung hay không

    # -------------------------------------------------------------- khung nội dung

    def _y(self, y):
        return CONTENT_TOP + (y - FRAME_TOP) * SCALE if self.content else y

    def _h(self, h):
        return h * SCALE if self.content else h

    def _pt(self, size):
        return Pt(round(size * FONT_SCALE * 2) / 2 if self.content else size)

    # -------------------------------------------------------------- primitives

    def text(self, slide, x, y, w, h, text, size=18, bold=False, color=DARK, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, italic=False, font=None):
        box = slide.shapes.add_textbox(inch(x), inch(self._y(y)), inch(w), inch(self._h(h)))
        tf = box.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = anchor
        tf.margin_left = tf.margin_right = inch(0.05)
        lines = text if isinstance(text, list) else [text]
        for i, line in enumerate(lines):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = align
            self._runs(p, line, size, bold, color, italic, font)
        return box

    def _runs(self, p, line, size, bold, color, italic=False, font=None):
        # **đậm** trong dòng: tô xanh của Viện (đỏ PTIT để dành cho điểm nhấn khung)
        parts = line.split("**")
        for k, part in enumerate(parts):
            if not part:
                continue
            r = p.add_run()
            r.text = part
            r.font.name = font or FONT
            r.font.size = self._pt(size)
            r.font.bold = bold or (k % 2 == 1)
            r.font.italic = italic
            r.font.color.rgb = RIPT_BLUE if (k % 2 == 1 and not bold) else color

    def bullets(self, slide, x, y, w, h, items, size=18, color=DARK, gap=6):
        box = slide.shapes.add_textbox(inch(x), inch(self._y(y)), inch(w), inch(self._h(h)))
        tf = box.text_frame
        tf.word_wrap = True
        first = True
        for item in items:
            level = 0
            if item.startswith("  "):
                level, item = 1, item.strip()
            p = tf.paragraphs[0] if first else tf.add_paragraph()
            first = False
            p.space_after = self._pt(gap)
            marker = "▪ " if level == 0 else "– "
            r = p.add_run()
            r.text = ("      " if level else "") + marker
            r.font.name = FONT
            r.font.size = self._pt(size - 2 * level)
            r.font.color.rgb = PTIT_RED if level == 0 else GREY
            r.font.bold = True
            self._runs(p, item, size - 2 * level, False, color)
        return box

    def rect(self, slide, x, y, w, h, fill=LIGHT, line=None, shape=MSO_SHAPE.RECTANGLE):
        s = slide.shapes.add_shape(shape, inch(x), inch(self._y(y)), inch(w), inch(self._h(h)))
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
        y, h = self._y(y), (self._h(h) if h else h)
        if w and h:
            scale = min(w / iw, h / ih)
            pw, ph = iw * scale, ih * scale
            return slide.shapes.add_picture(path, inch(x + (w - pw) / 2), inch(y + (h - ph) / 2), inch(pw), inch(ph))
        if w:
            return slide.shapes.add_picture(path, inch(x), inch(y), width=inch(w))
        return slide.shapes.add_picture(path, inch(x), inch(y), height=inch(h))

    def cropped_image(self, slide, path, right, y, h, crop, frame=None):
        """Chèn một phần ảnh (crop = trái, trên, phải, dưới theo tỷ lệ), cao h, giữ tỷ lệ
        phần còn lại, mép phải tại `right`; `frame` là màu viền nền 0,05 in quanh ảnh."""
        from PIL import Image

        iw, ih = Image.open(path).size
        left, top, cut_right, bottom = crop
        y, h = self._y(y), self._h(h)
        w = h * iw * (1 - left - cut_right) / (ih * (1 - top - bottom))
        if frame is not None:
            content, self.content = self.content, False  # toạ độ đã quy đổi
            self.rect(slide, right - w - 0.05, y - 0.05, w + 0.1, h + 0.1, fill=frame)
            self.content = content
        pic = slide.shapes.add_picture(path, inch(right - w), inch(y), inch(w), inch(h))
        pic.crop_left, pic.crop_top, pic.crop_right, pic.crop_bottom = crop
        return pic

    def table(self, slide, x, y, w, rows, col_w=None, size=13, header_fill=PTIT_RED, row_h=0.4):
        nr, nc = len(rows), len(rows[0])
        shape = slide.shapes.add_table(nr, nc, inch(x), inch(self._y(y)), inch(w), inch(self._h(row_h) * nr))
        t = shape.table
        if col_w:
            total = sum(col_w)
            for i, cw in enumerate(col_w):
                t.columns[i].width = inch(w * cw / total)
        for row in t.rows:
            row.height = inch(self._h(row_h))
        for ri, row in enumerate(rows):
            for ci, val in enumerate(row):
                cell = t.cell(ri, ci)
                cell.margin_left = cell.margin_right = inch(0.08)
                cell.margin_top = cell.margin_bottom = inch(0.03)
                cell.vertical_anchor = MSO_ANCHOR.MIDDLE
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

    # -------------------------------------------------------------- nhận diện của mẫu

    def _picture(self, slide, blob, box, crop_top=0.0, crop_bottom=0.0):
        pic = slide.shapes.add_picture(io.BytesIO(blob), Emu(box[0]), Emu(box[1]), Emu(box[2]), Emu(box[3]))
        pic.crop_top, pic.crop_bottom = crop_top, crop_bottom
        return pic

    def _institute(self, slide):
        """Logo và tên Viện KHKT Bưu điện ở góc phải trên (logo PTIT bên trái đã có trong layout)."""
        self._picture(slide, self.ript_logo, RIPT_LOGO)
        self._picture(slide, self.ript_name, RIPT_NAME, crop_top=RIPT_NAME_CROP_TOP)
        box = slide.shapes.add_textbox(Emu(RIPT_EN[0]), Emu(RIPT_EN[1]), inch(4.9), inch(0.34))
        box.text_frame.word_wrap = True
        r = box.text_frame.paragraphs[0].add_run()
        r.text = "Research Institute of Posts and Telecommunications"
        r.font.name, r.font.size = TITLE_FONT, Pt(14)
        r.font.color.rgb = RGBColor(0x37, 0x3D, 0x4E)

    # -------------------------------------------------------------- slide kinds

    def cover(self):
        """Slide bìa của mẫu: nền trắng, dải đỏ phía dưới (từ 5,3 in), hai logo."""
        slide = self.prs.slides.add_slide(self.layout_cover)
        self.count += 1
        self.content = False
        self._picture(slide, self.cover_bg, (0, 0, self.prs.slide_width, self.prs.slide_height), crop_bottom=COVER_BG_CROP_BOTTOM)
        self._picture(slide, self.ptit_logo, PTIT_COVER)
        self._institute(slide)
        return slide

    def new(self, title: str):
        """Slide nội dung: tiêu đề Times New Roman đậm như mẫu, số trang trong ô đỏ chân trang."""
        slide = self.prs.slides.add_slide(self.layout_blank)
        self.count += 1
        self.content = False
        self._institute(slide)
        self.text(slide, 0.5, 0.98, 11.9, 0.7, title, size=30, bold=True, color=BLACK, anchor=MSO_ANCHOR.MIDDLE, font=TITLE_FONT)
        # Ô đỏ số trang nằm trong ảnh chân trang của layout (x ≈ 12,0–12,45 in).
        self.text(slide, 11.95, 7.03, 0.55, 0.36, str(self.count), size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        self.content = True
        return slide

    def save(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.prs.save(path)
