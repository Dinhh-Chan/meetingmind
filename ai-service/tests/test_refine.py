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


def test_moc_thoi_gian_lay_theo_tu_duoc_chon():
    base = words("cơ án", start=10.0)
    refined = [(10.1, 10.4, " phương"), (10.4, 10.9, " án")]
    assert merge_words(base, refined) == [(10.1, 10.4, " phương"), (10.0 + 1, 10.0 + 1.5, " án")]


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
