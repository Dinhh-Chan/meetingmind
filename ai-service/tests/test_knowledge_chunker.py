"""Cắt đoạn để lập chỉ mục hỏi đáp: transcript, mục biên bản, tài liệu; tách chữ tài liệu."""

import re

import pytest

from app.worker.document_text import UnsupportedDocument, document_kind, extract_text
from app.worker.knowledge_chunker import (
    chunk_document,
    chunk_header,
    chunk_items,
    chunk_transcript,
    embed_text,
    fmt_ts,
    parse_line,
    split_text,
)


def segments(n: int, words: int = 12) -> list[dict]:
    speakers = ["Lan", "Hùng", "Minh"]
    return [
        {
            "speaker": speakers[i % 3],
            "text": f"Câu số {i} " + " ".join(f"từ{i}_{k}" for k in range(words)) + ".",
            "startMs": i * 7_000 + 250,
            "endMs": i * 7_000 + 6_000,
        }
        for i in range(n)
    ]


# ---------- transcript ----------


def test_fmt_ts_and_parse_line_round_trip():
    assert fmt_ts(0) == "00:00"
    assert fmt_ts(65_999) == "01:05"
    assert fmt_ts(4_530_000) == "75:30"  # họp dài: phút cứ tăng
    assert parse_line("[01:05] Hùng: Hạn VNPay là 18/11.") == (65_000, "Hùng", "Hạn VNPay là 18/11.")


def test_transcript_groups_segments_within_size_and_prefixes_lines():
    items = segments(40)
    chunks = chunk_transcript(items)
    assert len(chunks) > 1
    for chunk in chunks[:-1]:
        assert 500 <= len(chunk.content) <= 900
    assert len(chunks[-1].content) <= 900
    for chunk in chunks:
        for line in chunk.content.split("\n"):
            assert re.match(r"^\[\d{2}:\d{2}\] (Lan|Hùng|Minh): Câu số \d+ ", line)


def test_transcript_never_splits_a_segment_and_keeps_order():
    items = segments(40)
    chunks = chunk_transcript(items)
    lines = [line for c in chunks for line in c.content.split("\n")]
    assert len(lines) == len(items)
    for line, item in zip(lines, items):
        assert line.endswith(item["text"])


def test_transcript_chunk_keeps_time_range_and_main_speaker():
    items = [
        {"speaker": "Lan", "text": "Chào mọi người.", "startMs": 1_000, "endMs": 2_000},
        {"speaker": "Hùng", "text": "Em đề xuất dùng PostgreSQL vì cần pgvector cho phần tìm kiếm.", "startMs": 2_500, "endMs": 8_000},
        {"speaker": "Lan", "text": "Ok chốt.", "startMs": 8_500, "endMs": 9_000},
    ]
    [chunk] = chunk_transcript(items)
    assert chunk.start_ms == 1_000 and chunk.end_ms == 9_000
    assert chunk.metadata["speaker"] == "Hùng"
    assert set(chunk.metadata["speakers"]) == {"Lan", "Hùng"}
    assert chunk.metadata["lineStartMs"] == [1_000, 2_500, 8_500]
    assert chunk.content.split("\n")[1] == "[00:02] Hùng: Em đề xuất dùng PostgreSQL vì cần pgvector cho phần tìm kiếm."


def test_long_segment_stands_alone_and_is_not_cut():
    long_text = "Một lượt nói rất dài. " * 80  # ~1700 ký tự
    items = segments(3) + [{"speaker": "Lan", "text": long_text, "startMs": 60_000}] + segments(2)
    chunks = chunk_transcript(items)
    holder = [c for c in chunks if long_text.strip() in c.content]
    assert len(holder) == 1
    assert holder[0].content.count("\n") == 0  # đứng riêng một đoạn


def test_transcript_skips_empty_segments_and_missing_speaker():
    chunks = chunk_transcript([{"text": "  "}, {"text": "Không ai nhận tên", "startMs": None}])
    assert [c.content for c in chunks] == ["Không rõ: Không ai nhận tên"]


# ---------- biên bản / quyết định / công việc ----------


def test_items_one_chunk_per_item_with_title():
    chunks = chunk_items(
        [
            {"title": "Dùng PostgreSQL", "text": "Cả nhóm chốt dùng PostgreSQL."},
            {"title": "", "text": ""},
            {"title": "Tích hợp VNPay", "text": "Hạn 18/11.", "startMs": 4_000},
        ]
    )
    assert [c.content for c in chunks] == ["Dùng PostgreSQL\nCả nhóm chốt dùng PostgreSQL.", "Tích hợp VNPay\nHạn 18/11."]
    assert chunks[1].metadata["title"] == "Tích hợp VNPay" and chunks[1].start_ms == 4_000


def test_long_item_split_at_paragraphs_and_title_repeated():
    paragraphs = [f"Đoạn {i}: " + "nội dung biên bản " * 25 for i in range(4)]  # ~460 ký tự mỗi đoạn
    chunks = chunk_items([{"title": "Biên bản họp", "text": "\n\n".join(paragraphs)}])
    assert len(chunks) >= 2
    for chunk in chunks:
        assert chunk.content.startswith("Biên bản họp\n")
        assert len(chunk.content) <= 900 + 20
    body = "\n".join(c.content.split("\n", 1)[1] for c in chunks)
    for p in paragraphs:
        assert p.strip() in body  # không cắt giữa đoạn văn khi đoạn văn vừa giới hạn


# ---------- tài liệu ----------


def test_document_chunks_respect_paragraphs_and_overlap():
    paragraphs = [f"Mục {i}. " + " ".join(f"chữ{i}x{k}" for k in range(40)) for i in range(12)]
    text = "\n\n".join(paragraphs)
    chunks = chunk_document(text)
    assert len(chunks) >= 3
    for chunk in chunks:
        assert len(chunk.content) <= 900 + 5
    for previous, current in zip(chunks, chunks[1:]):
        # Khối sau bắt đầu bằng ~100 ký tự cuối của khối trước.
        head = current.content[:60]
        assert head in previous.content[-130:]
    # Mọi đoạn văn đều có mặt, không mất chữ.
    joined = " ".join(c.content for c in chunks)
    for k in range(40):
        assert f"chữ11x{k}" in joined


def test_split_text_breaks_huge_paragraph_by_sentence_then_word():
    text = "Câu ngắn. " * 300 + "x" * 2000
    parts = split_text(text, 900, overlap=100)
    assert all(len(p) <= 900 for p in parts)
    assert "".join(parts).count("x") >= 2000


def test_header_and_embed_text():
    header = chunk_header("Họp sprint 3", "decision", "Dùng PostgreSQL")
    assert header == "Cuộc họp: Họp sprint 3\nNguồn: Quyết định — Dùng PostgreSQL"
    assert embed_text(header, "nội dung").endswith("\n\nnội dung")
    assert chunk_header("Họp", "transcript") == "Cuộc họp: Họp\nNguồn: Transcript"


# ---------- tách chữ ----------


def test_document_kind_prefers_extension():
    assert document_kind("ghi-chu.md", "application/octet-stream") == "text"
    assert document_kind("spec.PDF") == "pdf"
    assert document_kind("x", "application/vnd.openxmlformats-officedocument.wordprocessingml.document") == "docx"
    with pytest.raises(UnsupportedDocument):
        document_kind("cu.doc", "application/msword")


def test_extract_txt_and_docx(tmp_path):
    txt = tmp_path / "a.txt"
    txt.write_bytes("﻿Xin chào\n\nĐoạn hai".encode("utf-8"))
    assert extract_text(txt, "a.txt", "text/plain") == "Xin chào\n\nĐoạn hai"

    import docx

    document = docx.Document()
    document.add_paragraph("Quyết định dùng PostgreSQL.")
    table = document.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text = "Hùng"
    table.rows[0].cells[1].text = "Nhắc lịch"
    path = tmp_path / "b.docx"
    document.save(str(path))
    text = extract_text(path, "b.docx")
    assert "Quyết định dùng PostgreSQL." in text
    assert "Hùng | Nhắc lịch" in text
