from app.meet import with_english_ui


def test_them_hl_en():
    assert with_english_ui("https://meet.google.com/abc-defg-hij") == "https://meet.google.com/abc-defg-hij?hl=en"


def test_giu_tham_so_cu_va_ghi_de_hl():
    url = with_english_ui("https://meet.google.com/abc-defg-hij?authuser=1&hl=vi")
    assert url == "https://meet.google.com/abc-defg-hij?authuser=1&hl=en"


def test_nhan_nut_vao_phong_khong_khop_nham():
    import re

    from app.meet import LABEL_JOIN

    def matches(label, name):
        return re.match(rf"^{re.escape(label)}", name, re.IGNORECASE) is not None

    assert any(matches(l, "Ask to join without microphone & camera") for l in LABEL_JOIN)
    assert not any(matches(l, "Other ways to join") for l in LABEL_JOIN)
