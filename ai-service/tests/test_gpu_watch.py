"""Mất GPU: khởi động lại tối đa vài lần mỗi giờ."""

from app.worker import gpu_watch


def test_gioi_han_so_lan_khoi_dong_lai_moi_gio(tmp_path):
    path = str(tmp_path / "gpu.json")
    assert [gpu_watch.should_restart(now=100.0 + i, path=path, limit=3) for i in range(4)] == [True, True, True, False]
    # Hết một giờ thì có lượt mới.
    assert gpu_watch.should_restart(now=100.0 + 3700, path=path, limit=3) is True


def test_tep_trang_thai_hong_thi_tinh_lai_tu_dau(tmp_path):
    path = tmp_path / "gpu.json"
    path.write_text("không phải json")
    assert gpu_watch.should_restart(now=5.0, path=str(path), limit=1) is True
    assert gpu_watch.should_restart(now=6.0, path=str(path), limit=1) is False


def test_khong_mat_gpu_thi_khong_lam_gi(monkeypatch):
    monkeypatch.setattr(gpu_watch, "lost", False)
    monkeypatch.setattr(gpu_watch.os, "_exit", lambda code: (_ for _ in ()).throw(AssertionError("không được thoát")))
    gpu_watch.restart_if_lost()


def test_mat_gpu_thi_thoat_de_docker_khoi_dong_lai(monkeypatch, tmp_path):
    codes = []
    monkeypatch.setattr(gpu_watch, "lost", False)
    monkeypatch.setattr(gpu_watch, "STATE_PATH", str(tmp_path / "gpu.json"))
    monkeypatch.setattr(gpu_watch, "should_restart", lambda: True)
    monkeypatch.setattr(gpu_watch.os, "_exit", codes.append)
    gpu_watch.mark_lost(RuntimeError("CUDA failed with error no CUDA-capable device is detected"))
    gpu_watch.restart_if_lost()
    assert codes == [75]
