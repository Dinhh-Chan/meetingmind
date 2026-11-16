"""Ghép lời Whisper với lời mô hình tiếng Việt: lấy từ tiếng Việt đúng hơn, giữ dấu câu, số, từ tiếng Anh."""

from app.worker.refine import is_protected, merge_words


def words(text, start=0.0):
    return [(start + i, start + i + 0.5, " " + t) for i, t in enumerate(text.split())]


def text(ws):
    return "".join(t for _, _, t in ws).strip()


def test_thay_tu_sai_giu_dau_cau_va_chu_hoa_dau_cau():
    base = words("Để phiên năng trực tiếp, nó có dãy đâu?")
    refined = words("để phiên âm trực tiếp nó có giãy đâu")
    assert text(merge_words(base, refined)) == "Để phiên âm trực tiếp, nó có giãy đâu?"


def test_giu_so_va_tu_tieng_anh_cua_whisper():
    base = words("Deadline của API là ngày 11, sprint này có 542,8 triệu gói.")
    refined = words("đét lai của ây pi ai là ngày mười một sờ prin này có năm trăm bốn mươi hai phẩy tám triệu gói")
    assert text(merge_words(base, refined)) == "Deadline của API là ngày 11, sprint này có 542,8 triệu gói."


def test_dau_cau_cuoi_cum_chuyen_sang_tu_thay_the():
    base = words("Tìm ra cơ án, mai trình lại.")
    refined = words("tìm ra phương án mai trình lại")
    assert text(merge_words(base, refined)) == "Tìm ra phương án, mai trình lại."


def test_ten_rieng_viet_hoa_giua_cau_duoc_giu_kieu_chu():
    base = words("Giao cho Hoàn Nguyên làm phần này.")
    refined = words("giao cho hoàng nguyễn làm phần này")
    assert text(merge_words(base, refined)) == "Giao cho Hoàng Nguyễn làm phần này."


def test_tu_whisper_bo_sot_duoc_them_tu_chi_mo_hinh_kia_bo_sot_thi_giu():
    base = words("Chúng ta cần báo cáo cụ thể.")
    refined = words("chúng ta cần có những báo cáo cụ thể")
    assert text(merge_words(base, refined)) == "Chúng ta cần có những báo cáo cụ thể."
    assert text(merge_words(words("Ừ, đúng rồi nhé."), words("đúng rồi"))) == "Ừ, đúng rồi nhé."


def test_lech_han_ve_do_dai_thi_giu_loi_whisper():
    base = words("Chào mọi người.")
    assert merge_words(base, words("một hai ba bốn năm sáu bảy tám chín mười mười một")) == base
    long = words("Hôm nay chúng ta họp về kế hoạch quý bốn của cả công ty nhé.")
    assert merge_words(long, words("hôm nay")) == long
    assert merge_words(base, []) == base


def test_moc_thoi_gian_luon_theo_whisper():
    # Từ thay thế nằm đúng khoảng thời gian của từ Whisper mà nó thay, bất kể mốc của mô hình kia.
    base = words("cơ án", start=10.0)
    refined = [(3.0, 3.1, " phương"), (99.0, 99.9, " án")]
    assert merge_words(base, refined) == [(10.0, 10.5, " phương"), (10.0 + 1, 10.0 + 1.5, " án")]
    # Hai từ thay một từ: chia đều khoảng của từ đó.
    base = [(0.0, 1.0, " nớp"), (1.0, 2.0, " lại")]
    out = merge_words(base, [(7.0, 7.1, " ghi"), (7.1, 7.2, " chép"), (7.2, 7.3, " lại")])
    assert out == [(0.0, 0.5, " ghi"), (0.5, 1.0, " chép"), (1.0, 2.0, " lại")]
    # Từ thêm vào nằm ở khe giữa hai từ Whisper kề nó.
    base = [(0.0, 1.0, " cần"), (1.4, 2.0, " báo"), (2.0, 3.0, " cáo")]
    out = merge_words(base, [(0, 0, " cần"), (0, 0, " có"), (0, 0, " báo"), (0, 0, " cáo")])
    assert out == [(0.0, 1.0, " cần"), (1.0, 1.4, " có"), (1.4, 2.0, " báo"), (2.0, 3.0, " cáo")]


def test_tu_can_giu():
    assert is_protected("11,", first=False) and is_protected("API", first=False) and is_protected("sprint", first=False)
    assert is_protected("Meet", first=False) and not is_protected("Meet", first=True)
    assert not is_protected("anh", first=False) and not is_protected("Nguyễn", first=False) and not is_protected("...", first=False)


def test_chi_thay_khi_mo_hinh_tieng_viet_tu_tin_hon():
    base = words("Chào mọi người.")
    refined = words("châu ngược")
    # Whisper chắc (0,9), mô hình kia đoán (0,4): giữ lời Whisper.
    assert text(merge_words(base, refined, [0.9] * 3, [0.4] * 2, margin=0.0)) == "Chào mọi người."
    # Whisper đoán (0,3), mô hình kia chắc (0,9): thay.
    assert text(merge_words(base, refined, [0.3] * 3, [0.9] * 2, margin=0.0)) == "Châu ngược."
    # Không đặt biên độ: luôn thay.
    assert text(merge_words(base, refined, [0.9] * 3, [0.4] * 2)) == "Châu ngược."


def test_bien_do_am_cho_thay_ca_khi_kem_tu_tin_hon_mot_chut():
    base = words("phiên năng trực tiếp")
    refined = words("phiên âm trực tiếp")
    assert text(merge_words(base, refined, [0.9, 0.6, 0.9, 0.9], [0.9, 0.55, 0.9, 0.9], margin=-0.1)) == "phiên âm trực tiếp"
    assert text(merge_words(base, refined, [0.9, 0.6, 0.9, 0.9], [0.9, 0.55, 0.9, 0.9], margin=0.0)) == "phiên năng trực tiếp"


def test_moc_tu_khong_lui_va_nam_trong_cau():
    from app.worker.refine import in_order

    mixed = [(1.0, 1.4, " một"), (0.6, 0.9, " hai"), (1.2, 1.1, " ba"), (2.6, 3.4, " bốn")]
    assert in_order(mixed, 1.0, 3.0) == [(1.0, 1.4, " một"), (1.4, 1.4, " hai"), (1.4, 1.4, " ba"), (2.6, 3.0, " bốn")]


def test_tu_nghe_them_o_hai_dau_cau_bi_bo():
    base = words("Tối nay mọi người về.")
    refined = words("hôm tối nay mọi người về nhé")
    assert text(merge_words(base, refined)) == "Tối nay mọi người về."


def test_ghep_token_bpe_thanh_tu_kem_moc():
    from app.worker.refine import group_tokens

    words, probs = group_tokens(["▁xin", "▁chà", "o", "▁mọi", "▁người"], [0.0, 0.4, 0.6, 1.0, 1.3], 10.0)
    assert [t for _, _, t in words] == [" xin", " chào", " mọi", " người"]
    assert words[1][0] == 10.4 and words[1][1] == 11.0
    assert words[-1][1] == 11.5
    assert probs is None
    import math

    _, probs = group_tokens(["▁xin", "▁chà", "o"], [0.0, 0.4, 0.6], 0.0, [math.log(0.9), math.log(0.5), math.log(0.8)])
    assert round(probs[0], 3) == 0.9 and round(probs[1], 3) == round(math.sqrt(0.5 * 0.8), 3)


def test_nhan_ra_thu_muc_transducer(tmp_path):
    from app.worker.refine import is_transducer

    for name in ("encoder.onnx", "decoder.onnx", "joiner.onnx"):
        (tmp_path / name).write_bytes(b"")
    assert not is_transducer(str(tmp_path))
    (tmp_path / "tokens.txt").write_text("a 0\n")
    assert is_transducer(str(tmp_path))


def test_token_sherpa_dau_cach_va_chu_hoa():
    from app.worker.refine import group_tokens, merge_words

    words, _ = group_tokens([" TIẾNG", " C", "Ạ", "CH", " KH", "Ự", "NG"], [0.0, 0.7, 0.8, 0.9, 1.3, 1.4, 1.5], 0.0)
    assert [t for _, _, t in words] == [" TIẾNG", " CẠCH", " KHỰNG"]
    base = [(0.0, 0.5, " Tiếng"), (0.7, 1.0, " cọc"), (1.3, 1.6, " khựng.")]
    assert "".join(t for _, _, t in merge_words(base, words)).strip() == "Tiếng cạch khựng."


def test_bien_do_mac_dinh_theo_loai_mo_hinh(monkeypatch):
    from app.worker import refine

    monkeypatch.delenv("AI_WHISPER_REFINE_MARGIN", raising=False)
    # PhoWhisper: chỉ thay khi tự tin hơn; transducer: luôn thay.
    assert refine.margin(refine._WhisperEngine.default_margin) == 0.0
    assert refine.margin(refine._TransducerEngine.default_margin) is None
    # Đặt biến môi trường thì theo biến, cho cả hai loại.
    monkeypatch.setenv("AI_WHISPER_REFINE_MARGIN", "0.1")
    assert refine.margin(None) == 0.1
    monkeypatch.setenv("AI_WHISPER_REFINE_MARGIN", "none")
    assert refine.margin(0.0) is None


def test_luot_sua_dung_bien_do_mac_dinh_cua_mo_hinh(monkeypatch):
    from app.worker import refine

    class Engine:
        default_margin = None
        trust_longer = False

        def words(self, clip, offset):
            return [(0.0, 0.5, " PHIÊN"), (0.5, 1.0, " ÂM")], [0.2, 0.2]

    monkeypatch.delenv("AI_WHISPER_REFINE_MARGIN", raising=False)
    monkeypatch.setenv("AI_WHISPER_REFINE_MODEL", "/khong/co")
    monkeypatch.setattr(refine, "_load", lambda device, compute_type: Engine())
    base = [(0.0, 0.5, " Phiên"), (0.5, 1.0, " năng.")]
    clip = [0.0] * 16000
    # Luôn thay dù Whisper tự tin hơn (0,9 so với 0,2).
    out = refine.refine_words(clip, 0.0, base, "cpu", "int8", [0.9, 0.9])
    assert "".join(t for _, _, t in out).strip() == "Phiên âm."
    # Mô hình có biên độ mặc định 0 thì giữ lời Whisper trong cùng tình huống.
    Engine.default_margin = 0.0
    out = refine.refine_words(clip, 0.0, base, "cpu", "int8", [0.9, 0.9])
    assert "".join(t for _, _, t in out).strip() == "Phiên năng."


def test_whisper_ket_vong_lap_thi_lay_loi_mo_hinh_tieng_viet():
    from app.worker.refine import is_loop

    assert is_loop("em cứ nổi loại em cứ nổi loại em cứ nổi loại".split())
    assert is_loop("alo alo alo".split())
    assert not is_loop("em cứ nói em vừa nói cái gì nữa".split())
    assert not is_loop("alo alo".split())

    base = words("Nổi loại, em cứ nổi loại, em cứ nổi loại, em cứ nổi loại.")
    refined = words("NÓI LẠI ĐI")
    merged = merge_words(base, refined)
    assert text(merged) == "Nói lại đi."
    # Lời thay thế trải trên đúng khoảng thời gian của câu Whisper.
    assert merged[0][0] == base[0][0] and merged[-1][1] == base[-1][1]
    # Không kẹt vòng lặp mà lệch hẳn độ dài: vẫn giữ lời Whisper như trước.
    base = words("Hôm nay chúng ta họp về kế hoạch quý tới của cả nhóm.")
    assert text(merge_words(base, words("HÔM NAY"))) == "Hôm nay chúng ta họp về kế hoạch quý tới của cả nhóm."
    # Mô hình tiếng Việt không nghe ra gì: giữ lời Whisper (không tự xoá câu).
    looped = words("Alo, alo, alo, alo.")
    assert text(merge_words(looped, [])) == "Alo, alo, alo, alo."


def test_mo_hinh_tieng_viet_nghe_ra_dai_hon_han():
    # Whisper chép cụt một đoạn dài; transducer nghe đủ câu.
    base = [(10.0, 10.5, " How"), (10.5, 11.0, " about"), (11.0, 11.5, " it?")]
    refined = words("TUẦN VỪA RỒI EM ĐÃ HOÀN THÀNH XONG BỘ API CHO TÍNH NĂNG ĐĂNG NHẬP")
    # Mặc định (PhoWhisper hay bịa): giữ lời Whisper.
    assert text(merge_words(base, refined)) == "How about it?"
    merged = merge_words(base, refined, trust_longer=True)
    assert text(merged) == "Tuần vừa rồi em đã hoàn thành xong bộ api cho tính năng đăng nhập?"
    assert merged[0][0] == 10.0 and merged[-1][1] == 11.5


def test_engine_transducer_tin_loi_dai_hon_whisper_thi_khong():
    from app.worker import refine

    assert refine._TransducerEngine.trust_longer is True
    assert refine._WhisperEngine.trust_longer is False
