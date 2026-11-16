"""Chuẩn hoá transcript bằng LLM: chỉ nhận dòng sửa lỗi nghe, giữ lời máy gốc, lỗi LLM không làm hỏng transcript.

Không gọi mạng: httpx.MockTransport đóng vai gateway.
"""

import asyncio
import json

import httpx

from app.worker import polish
from app.worker.polish import Settings, acceptable, build_messages, combine, edit_ops, read_lines, vote

SEGMENTS = [
    {"speakerLabel": "Người nói 1", "text": "Em đã đẩy vốt lên nhánh dev và cập nhật tài liệu trên sơ walker rồi ạ.", "startMs": 0, "endMs": 5000},
    {"speakerLabel": "Người nói 1", "text": "Tuy nhiên thì phần API xuất báo cáo Excel đang bị chậm, 30% sau với dự kiến.", "startMs": 5000, "endMs": 9000},
    {"speakerLabel": "Người nói 2", "text": "Ok, vậy hạn là ngày 18 nhé.", "startMs": 9000, "endMs": 11000},
]


def settings(**kw) -> Settings:
    # Mặc định một lần sửa để từng test nói rõ nó thử gì; bỏ phiếu có test riêng.
    return Settings(**{"base_url": "http://llm.test/v1", "api_key": "k", "model": "nhanh", "fallback_model": "", "votes": 1, "min_agree": 1, **kw})


def reply(lines: list[dict]) -> httpx.Response:
    content = json.dumps({"lines": lines}, ensure_ascii=False)
    return httpx.Response(200, json={"choices": [{"message": {"content": content}, "finish_reason": "stop"}]})


def run(segments, handler, **kw):
    return asyncio.run(polish.polish(segments, settings=settings(**kw.pop("settings", {})), transport=httpx.MockTransport(handler), **kw))


def test_chap_nhan_sua_loi_nghe():
    assert acceptable("Em đã đẩy vốt lên nhánh dev", "Em đã đẩy code lên nhánh dev.")
    assert acceptable("tài liệu trên sơ walker rồi ạ", "tài liệu trên Swagger rồi ạ")
    assert acceptable("sơ walker", "Swagger")
    assert acceptable("hôm nay mình điểm qua tiến độ cần trước", "Hôm nay mình điểm qua tiến độ tuần trước.")


def test_khong_nhan_dong_bi_viet_lai_hoac_doi_du_kien():
    line = "Tuy nhiên thì phần API xuất báo cáo Excel đang bị chậm, 30% sau với dự kiến."
    # Đổi con số.
    assert not acceptable(line, "Tuy nhiên thì phần API xuất báo cáo Excel đang bị chậm, 20% so với dự kiến.")
    assert not acceptable("Hạn là ngày 18 nhé", "Hạn là ngày 15 nhé")
    # Tóm tắt, bớt ý.
    assert not acceptable(line, "API xuất Excel chậm.")
    # Thêm ý.
    assert not acceptable("Ok chốt vậy nhé", "Ok chốt vậy nhé, em sẽ gửi báo cáo chi tiết cho cả nhóm trước thứ Sáu tuần này")
    # Diễn đạt lại gần hết câu.
    assert not acceptable("Em đang tối ưu lại câu truy cập SQL", "Hiện tại tôi tiến hành cải thiện hiệu năng truy vấn")
    assert not acceptable("Ok", "")


def test_prompt_co_nguoi_du_hop_thuat_ngu_va_ngu_canh():
    messages = build_messages(
        [(7, "Người nói 1", "đẩy vốt lên nhánh dev")],
        context=[(6, "Người nói 2", "phần backend thế nào rồi em")],
        people=["Minh", "Hùng"],
        title="Họp sprint 12",
        glossary=["Swagger", "VNPay"],
    )
    user = messages[1]["content"]
    assert "Người tham dự: Minh, Hùng" in user and "Cuộc họp: Họp sprint 12" in user and "Swagger, VNPay" in user
    assert user.index("[6] Người nói 2") < user.index("Các dòng cần xem và sửa") < user.index("[7] Người nói 1: đẩy vốt")
    assert "KHÔNG ĐƯỢC LÀM" in messages[0]["content"]


def test_doc_ket_qua_bo_tien_to_nguoi_noi_va_dong_la():
    lines = [(1, "Người nói 1", "đẩy vốt lên nhánh dev"), (2, "Người nói 2", "hạn là ngày 18")]
    data = {"lines": [
        {"i": 1, "text": "Người nói 1: Đẩy code lên nhánh dev."},
        {"i": 2, "text": "hạn là ngày 18"},        # không đổi: bỏ
        {"i": 9, "text": "dòng không tồn tại"},
        {"i": "x", "text": "hỏng"},
        "rác",
    ]}
    assert read_lines(data, lines) == {1: "Đẩy code lên nhánh dev."}


def test_cho_sua_theo_tu_cua_dong_goc():
    ops = edit_ops("em đã đẩy vốt lên nhánh dev", "Em đã đẩy code lên nhánh dev.")
    assert ops == [(0, 1, ("Em",)), (3, 4, ("code",)), (6, 7, ("dev.",))]
    assert edit_ops("tài liệu trên sơ walker rồi", "tài liệu trên Swagger rồi") == [(3, 5, ("Swagger",))]


def test_bo_phieu_chi_nhan_cho_sua_nhieu_lan_cung_dua_ra():
    original = "hôm nay mình điểm qua tiến độ cần trước và đẩy vốt lên sơ walker"
    runs = [
        "Hôm nay mình điểm qua tiến độ tuần trước và đẩy code lên Swagger.",
        "hôm nay mình điểm qua tiến độ hiện trước và đẩy code, lên Swagger",
        "Hôm nay mình điểm qua tiến độ gần trước và đẩy code lên Swagger",
    ]
    # "code", "Swagger", chữ hoa đầu câu: từ 2 lần trở lên. "cần" → tuần / hiện / gần: mỗi lần một kiểu, giữ lời máy.
    assert vote(original, runs, 2) == "Hôm nay mình điểm qua tiến độ cần trước và đẩy code lên Swagger"
    # Đòi cả ba lần thì chữ hoa đầu câu (2/3) cũng không qua.
    assert vote(original, runs, 3) == "hôm nay mình điểm qua tiến độ cần trước và đẩy code lên Swagger"
    # Một lần sửa: nhận hết của lần đó.
    assert vote(original, runs[:1], 1) == runs[0]


def test_gop_cac_lan_sua_roi_moi_kiem_tra_tung_dong():
    lines = [(1, "A", "đẩy vốt lên nhánh dev"), (2, "B", "hạn là ngày 18 nhé"), (3, "A", "ok chốt vậy")]
    runs = [
        {1: "đẩy code lên nhánh dev", 2: "hạn là ngày 28 nhé"},
        {1: "đẩy code lên nhánh dev", 2: "hạn là ngày 28 nhé", 3: "Ok, chốt vậy."},
        {1: "đẩy cốt lên nhánh dev"},
    ]
    changes, rejected = combine(lines, runs, 2, 0.5)
    # Dòng 2: hai lần cùng đổi số → qua bỏ phiếu nhưng bị kiểm tra loại. Dòng 3: chỉ một lần sửa → không nhận.
    assert changes == {1: "đẩy code lên nhánh dev"} and rejected == 1


def test_chuan_hoa_giu_loi_may_goc_va_chi_doi_dong_hop_le():
    def handler(request: httpx.Request) -> httpx.Response:
        return reply([
            {"i": 1, "text": "Em đã đẩy code lên nhánh dev và cập nhật tài liệu trên Swagger rồi ạ."},
            {"i": 2, "text": "API chậm 50%."},
        ])

    out, stats = run(SEGMENTS, handler)
    assert out[0]["text"] == "Em đã đẩy code lên nhánh dev và cập nhật tài liệu trên Swagger rồi ạ."
    assert out[0]["rawText"] == SEGMENTS[0]["text"]
    # Dòng 2 bị LLM tóm tắt và đổi số: giữ lời máy.
    assert out[1]["text"] == SEGMENTS[1]["text"] == out[1]["rawText"]
    assert out[2]["text"] == SEGMENTS[2]["text"]
    assert stats == {"changed": 1, "rejected": 1, "failed_chunks": 0}
    # Không sửa trực tiếp vào danh sách đầu vào.
    assert "rawText" not in SEGMENTS[0]


def test_llm_loi_thi_giu_nguyen_transcript():
    out, stats = run(SEGMENTS, lambda request: httpx.Response(500, text="boom"))
    assert [s["text"] for s in out] == [s["text"] for s in SEGMENTS]
    assert all(s["rawText"] == s["text"] for s in out)
    assert stats == {"changed": 0, "rejected": 0, "failed_chunks": 1}


def test_model_du_phong_khi_model_chinh_hong():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        model = json.loads(request.content)["model"]
        seen.append(model)
        return httpx.Response(402, text="hết tiền") if model == "nhanh" else reply([{"i": 3, "text": "Ok, vậy hạn là ngày 18 nhé!"}])

    out, stats = run(SEGMENTS, handler, settings={"fallback_model": "du-phong"})
    assert seen == ["nhanh", "du-phong"] and stats["changed"] == 1 and out[2]["text"].endswith("nhé!")


def test_chia_khoi_va_dua_ngu_canh_cac_dong_truoc():
    bodies = []

    def handler(request: httpx.Request) -> httpx.Response:
        bodies.append(json.loads(request.content)["messages"][1]["content"])
        return reply([])

    segments = [{"speakerLabel": "Người nói 1", "text": f"câu số {n}"} for n in range(1, 8)]
    _, stats = run(segments, handler, settings={"chunk_lines": 3, "context_lines": 2, "concurrency": 1})
    assert len(bodies) == 3 and stats == {"changed": 0, "rejected": 0, "failed_chunks": 0}
    second = next(b for b in bodies if "[4] Người nói 1: câu số 4" in b.split("Các dòng cần xem và sửa")[1])
    context = second.split("Các dòng cần xem và sửa")[0]
    assert "[2] Người nói 1: câu số 2" in context and "[3] Người nói 1: câu số 3" in context and "[1]" not in context


def test_ba_lan_sua_doc_lap_chi_nhan_cho_trung_nhau():
    answers = iter([
        [{"i": 1, "text": "Em đã đẩy code lên nhánh dev và cập nhật tài liệu trên Swagger rồi ạ."}],
        [{"i": 1, "text": "Em đã đẩy code lên nhánh dev và cập nhật tài liệu trên sơ đồ rồi ạ."}, {"i": 3, "text": "Ok, vậy hạn chót là ngày 18 nhé."}],
        [{"i": 1, "text": "Em đã đẩy vốt lên nhánh dev và cập nhật tài liệu trên Swagger rồi ạ."}],
    ])
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(json.loads(request.content)["temperature"])
        return reply(next(answers))

    out, stats = run(SEGMENTS, handler, settings={"votes": 3, "min_agree": 2})
    assert len(calls) == 3
    # "code" và "Swagger" mỗi chỗ 2/3 lần; "sơ đồ" và "hạn chót" chỉ 1 lần.
    assert out[0]["text"] == "Em đã đẩy code lên nhánh dev và cập nhật tài liệu trên Swagger rồi ạ."
    assert out[2]["text"] == SEGMENTS[2]["text"]
    assert stats == {"changed": 1, "rejected": 0, "failed_chunks": 0}


def test_thieu_lan_sua_thi_giu_nguyen():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(1)
        # Chỉ lần đầu trả được; hai lần sau lỗi → không đủ 2 lần để bỏ phiếu.
        return reply([{"i": 3, "text": "Ok, vậy hạn là ngày 18 nhé!"}]) if len(seen) == 1 else httpx.Response(500, text="boom")

    out, stats = run(SEGMENTS, handler, settings={"votes": 3, "min_agree": 2})
    assert out[2]["text"] == SEGMENTS[2]["text"] and stats["failed_chunks"] == 1


def test_khong_co_khoa_hoac_tat_thi_bo_qua(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("không được gọi LLM")

    out, stats = run(SEGMENTS, handler, settings={"api_key": ""})
    assert stats["changed"] == 0 and out[0]["rawText"] == SEGMENTS[0]["text"]
    monkeypatch.setenv("AI_POLISH", "0")
    out, stats = run(SEGMENTS, handler)
    assert stats["changed"] == 0 and [s["text"] for s in out] == [s["text"] for s in SEGMENTS]


def test_transcript_rong():
    out, stats = run([], lambda request: reply([]))
    assert out == [] and stats["changed"] == 0


def test_worker_gui_loi_may_khi_chuan_hoa_loi_hoac_qua_gio(monkeypatch):
    from app.worker import main

    async def boom(*args, **kwargs):
        raise RuntimeError("LLM sập")

    async def slow(*args, **kwargs):
        await asyncio.sleep(5)

    monkeypatch.setattr(main.polish, "enabled", lambda: True)
    monkeypatch.setattr(main.polish, "polish", boom)
    assert asyncio.run(main.polish_transcript(SEGMENTS, {})) is SEGMENTS
    monkeypatch.setattr(main.polish, "polish", slow)
    monkeypatch.setattr(main, "POLISH_TOTAL_TIMEOUT_S", 0.05)
    assert asyncio.run(main.polish_transcript(SEGMENTS, {})) is SEGMENTS


def test_worker_dua_ten_cuoc_hop_va_nguoi_du_vao_buoc_chuan_hoa(monkeypatch):
    from app.worker import main

    seen = {}

    async def fake(segments, people=None, title=None, glossary=None):
        seen.update(people=people, title=title, glossary=glossary)
        return [{**segments[0], "text": "đã sửa", "rawText": segments[0]["text"]}], {"changed": 1, "rejected": 0, "failed_chunks": 0}

    monkeypatch.setattr(main.polish, "enabled", lambda: True)
    monkeypatch.setattr(main.polish, "polish", fake)
    out = asyncio.run(main.polish_transcript(SEGMENTS[:1], {"title": "Họp sprint", "people": ["Minh", "Hùng"]}))
    assert out[0]["text"] == "đã sửa" and out[0]["rawText"] == SEGMENTS[0]["text"]
    assert seen == {"people": ["Minh", "Hùng"], "title": "Họp sprint", "glossary": None}
    # Tắt hoặc không có khoá LLM: không gọi gì, trả nguyên.
    monkeypatch.setattr(main.polish, "enabled", lambda: False)
    assert asyncio.run(main.polish_transcript(SEGMENTS, {})) is SEGMENTS
