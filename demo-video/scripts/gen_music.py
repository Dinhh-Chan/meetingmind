"""Tổng hợp nhạc nền điện tử 120 BPM (kick, hat, clap, bass sidechain, pad, arp) -> public/music/bed.flac.

Bố cục bám theo timeline video (src/timeline.ts): 1 ô nhịp = 2 s = 60 khung hình.
  - 0–6 s   intro tối (pad + nhịp tim)
  - 6–12 s  nhịp vào, 10–14 s build (trống dồn), lặng 0,25 s trước drop
  - 14 s    DROP (logo)
  - 46–48 s breakdown -> 48 s drop phụ (khoảnh khắc duyệt)
  - 72–74 s build -> 74 s outro, 82 s đòn kết, đuôi pad tới 86 s

  python gen_music.py
"""
import os
import re
import subprocess

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, sosfilt_zi

SR = 48000
BPM = 120
BEAT = 60 / BPM
BAR = 4 * BEAT
TOTAL = 86.0
N = int(TOTAL * SR)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "music")
rng = np.random.default_rng(2026)

# ------------------------------------------------------------------ bố cục
DROPS = [14.0, 48.0, 74.0]          # giây có drop (crash + lặng trước 0,25 s)
CRASH = [14.0, 26.0, 36.0, 48.0, 58.0, 68.0, 74.0]
END_HIT = 82.0


def section(t):
    """Trả về tên đoạn tại thời điểm t (giây)."""
    if t < 6:
        return "intro"
    if t < 10:
        return "groove_lo"
    if t < 12:
        return "build1"
    if t < 14:
        return "build2"
    if t < 46:
        return "full"
    if t < 48:
        return "break"
    if t < 72:
        return "full2"
    if t < 74:
        return "build2"
    if t < 78:
        return "full2"
    if t < 82:
        return "outro"
    return "end"


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# Am – F – C – G (mỗi hợp âm 1 ô nhịp), bắt đầu Am tại drop 14 s (ô nhịp 7)
PROG = [
    ([57, 60, 64, 69], 33),   # Am
    ([53, 57, 60, 65], 29),   # F
    ([55, 60, 64, 67], 36),   # C
    ([55, 59, 62, 67], 31),   # G
]


def chord_at_bar(b):
    if b < 3:
        return PROG[0]
    return PROG[(b - 7) % 4]


# ------------------------------------------------------------------ tiện ích
def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def add(buf, x, t0, gain=1.0):
    i = int(round(t0 * SR))
    if i >= len(buf):
        return
    x = x[: len(buf) - i]
    buf[i:i + len(x)] += x * gain


def saw(f, n, phase0=0.0):
    ph = (phase0 + np.cumsum(np.full(n, f / SR))) % 1.0
    return 2 * ph - 1


def tv_lowpass(x, cutoff_fn, chunk=512):
    """Lọc thấp với tần số cắt thay đổi theo thời gian (cập nhật hệ số theo khối, giữ trạng thái)."""
    y = np.zeros_like(x)
    zi = None
    for s in range(0, len(x), chunk):
        fc = float(np.clip(cutoff_fn((s + chunk / 2) / SR), 60, 16000))
        sos = butter(2, fc, btype="low", fs=SR, output="sos")
        if zi is None:
            zi = sosfilt_zi(sos) * 0
        y[s:s + chunk], zi = sosfilt(sos, x[s:s + chunk], zi=zi)
    return y


# ------------------------------------------------------------------ nhạc cụ
def kick(dur=0.42):
    t = np.arange(int(dur * SR)) / SR
    f = 44 + 120 * np.exp(-t / 0.032)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.24)
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.003) * 0.35
    return np.tanh(1.7 * (body + click))


def clap():
    dur = 0.35
    t = np.arange(int(dur * SR)) / SR
    env = np.zeros_like(t)
    for d in (0.0, 0.010, 0.021):
        tt = np.maximum(t - d, 0)
        env += (t >= d) * np.exp(-tt / 0.006)
    env += (t >= 0.03) * np.exp(-np.maximum(t - 0.03, 0) / 0.11) * 0.7
    return bp(rng.standard_normal(len(t)), 900, 3200) * env


def snare():
    dur = 0.25
    t = np.arange(int(dur * SR)) / SR
    return bp(rng.standard_normal(len(t)), 1500, 7000) * np.exp(-t / 0.06) + 0.6 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04)


def hat(open_=False):
    dur = 0.4 if open_ else 0.07
    t = np.arange(int(dur * SR)) / SR
    return hp(rng.standard_normal(len(t)), 7500) * np.exp(-t / (0.14 if open_ else 0.018))


def crash(dur=3.0):
    t = np.arange(int(dur * SR)) / SR
    l = hp(rng.standard_normal(len(t)), 3800) * np.exp(-t / 0.9)
    r = hp(rng.standard_normal(len(t)), 3800) * np.exp(-t / 0.9)
    shim = bp(rng.standard_normal(len(t)), 6000, 12000) * np.exp(-t / 0.5) * 0.5
    return np.stack([l + shim, r + shim], axis=1)


def pluck(f, dur=0.22):
    t = np.arange(int(dur * SR)) / SR
    x = sum(np.sin(2 * np.pi * f * k * t) / k for k in (1, 3, 5, 7)) + 0.3 * saw(f * 1.004, len(t))
    return lp(x * np.exp(-t / 0.07) * np.minimum(1, t / 0.002), 3200)


# ------------------------------------------------------------------ dựng bài
def build():
    drums = np.zeros((N, 2))
    bass = np.zeros(N)
    pad_l = np.zeros(N)
    pad_r = np.zeros(N)
    arp = np.zeros(N)
    sc = np.ones(N)                      # đường sidechain (giảm theo kick)

    K, C, S, H, HO = kick(), clap(), snare(), hat(), hat(True)
    sc_shape = 1 - 0.75 * np.exp(-np.arange(int(0.35 * SR)) / SR / 0.075)

    nbeats = int(TOTAL / BEAT)
    for bi in range(nbeats):
        t = bi * BEAT
        sec = section(t)
        bar = int(t // BAR)
        beat_in_bar = bi % 4
        gap = any(d - 0.25 <= t < d for d in DROPS)
        if gap:
            continue
        # ---- kick
        kick_on = sec in ("groove_lo", "build1", "full", "full2") or (sec == "outro" and t < 80)
        if sec == "intro":
            # nhịp tim: kick mềm ở phách 1 và 3, lọc thấp
            if beat_in_bar in (0, 2) and t >= 0.5:
                add(drums[:, 0], lp(K, 300), t, 0.35)
                add(drums[:, 1], lp(K, 300), t, 0.35)
        if kick_on:
            add(drums[:, 0], K, t, 0.95)
            add(drums[:, 1], K, t, 0.95)
            i = int(t * SR)
            seg = sc_shape[: N - i]
            sc[i:i + len(seg)] = np.minimum(sc[i:i + len(seg)], seg)
        # ---- clap phách 2, 4
        if sec in ("full", "full2") and beat_in_bar in (1, 3):
            add(drums[:, 0], C, t, 0.8)
            add(drums[:, 1], C, t + 0.004, 0.8)
        # ---- hat
        if sec in ("groove_lo", "build1", "full", "full2", "outro"):
            add(drums[:, 0], H, t + BEAT / 2, 0.35)
            add(drums[:, 1], H, t + BEAT / 2, 0.45)
            if sec in ("full", "full2"):
                for k in (1, 3):
                    add(drums[:, 1 if k == 1 else 0], H, t + k * BEAT / 4, 0.10)
                if beat_in_bar == 3:
                    add(drums[:, 0], HO, t + BEAT / 2, 0.12)
                    add(drums[:, 1], HO, t + BEAT / 2, 0.12)
        # ---- bass: nốt móc nửa phách, theo hợp âm
        if sec in ("groove_lo", "build1", "full", "full2", "outro"):
            _, root = chord_at_bar(bar)
            f = midi(root + 12)
            for off, ln, g in ((BEAT / 2, 0.22, 1.0), (3 * BEAT / 4, 0.1, 0.55 if sec in ("full", "full2") else 0.0)):
                if g == 0:
                    continue
                n = int(ln * SR)
                tt = np.arange(n) / SR
                note = (saw(f, n) + saw(f * 1.006, n) * 0.7 + np.sin(2 * np.pi * f / 2 * tt) * 1.2)
                note *= np.minimum(1, tt / 0.004) * np.exp(-tt / 0.2)
                note[-200:] *= np.linspace(1, 0, 200)
                add(bass, note, t + off, g)
        # ---- arp móc đơn 16 (từ 26 s và đoạn full2)
        if (sec == "full" and t >= 26) or sec == "full2":
            notes, _ = chord_at_bar(bar)
            seq = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[3] + 12]
            for k in range(4):
                idx = (bi * 4 + k) % 4
                add(arp, pluck(midi(seq[idx])), t + k * BEAT / 4, 0.55 if k % 2 == 0 else 0.4)

    # ---- trống dồn trong build (8 -> 16 -> 32), tăng dần
    for (a, b) in ((10.0, 14.0), (46.0, 48.0), (72.0, 74.0)):
        t = a
        while t < b - 0.25:
            p = (t - a) / (b - a)
            step = BEAT / 2 if p < 0.35 else (BEAT / 4 if p < 0.7 else BEAT / 8)
            add(drums[:, 0], S, t, 0.15 + 0.45 * p)
            add(drums[:, 1], S, t + 0.003, 0.15 + 0.45 * p)
            t += step

    # ---- crash + kick lớn ở các drop
    for c in CRASH:
        cr = crash()
        i = int(c * SR)
        seg = cr[: N - i]
        drums[i:i + len(seg)] += seg * 0.33
    for d in DROPS + [END_HIT]:
        add(drums[:, 0], K, d, 0.4)
        add(drums[:, 1], K, d, 0.4)
    cr = crash(4.0)
    i = int(END_HIT * SR)
    drums[i:i + len(cr[: N - i])] += cr[: N - i] * 0.4

    # ---- pad supersaw theo ô nhịp
    nbars = int(np.ceil(TOTAL / BAR))
    for b in range(nbars):
        t0 = b * BAR
        sec = section(t0 + 0.01)
        if sec == "end" and t0 > END_HIT + 0.1:
            continue
        notes, _ = chord_at_bar(b)
        if sec == "end":
            notes = PROG[0][0]
            ln = 4.0
        else:
            ln = BAR + 0.35
        n = int(ln * SR)
        tt = np.arange(n) / SR
        envp = np.minimum(1, tt / 0.18) * np.minimum(1, (ln - tt) / 0.35)
        if sec == "end":
            envp = np.minimum(1, tt / 0.02) * np.exp(-tt / 1.2)
        for note in notes:
            f = midi(note)
            for j, det in enumerate((-0.12, -0.05, 0.0, 0.05, 0.12)):
                osc = saw(f * 2 ** (det / 12), n, phase0=rng.uniform())
                if j % 2 == 0:
                    pad_l[int(t0 * SR):int(t0 * SR) + n] += (osc * envp)[: N - int(t0 * SR)] * 0.12
                else:
                    pad_r[int(t0 * SR):int(t0 * SR) + n] += (osc * envp)[: N - int(t0 * SR)] * 0.12
            # sine trầm cho dày
            pad_l[int(t0 * SR):int(t0 * SR) + n] += (np.sin(2 * np.pi * f / 2 * tt) * envp)[: N - int(t0 * SR)] * 0.08
            pad_r[int(t0 * SR):int(t0 * SR) + n] += (np.sin(2 * np.pi * f / 2 * tt) * envp)[: N - int(t0 * SR)] * 0.08

    def pad_cut(t):
        s = section(t)
        if s == "intro":
            return 500 + 150 * np.sin(t)
        if s == "groove_lo":
            return 900
        if s == "build1":
            return 900 + (t - 10) / 2 * 900
        if s == "build2":
            a = 12 if t < 14 else 72
            return 1800 * (5000 / 1800) ** ((t - a) / 2)
        if s == "break":
            return 700 * (5000 / 700) ** ((t - 46) / 2)
        if s in ("full", "full2"):
            return 3800
        if s == "outro":
            return 2600 - (t - 78) / 4 * 1800
        return 900
    pad_l = tv_lowpass(pad_l, pad_cut)
    pad_r = tv_lowpass(pad_r, pad_cut)

    bass = lp(bass, 600)
    bass = np.tanh(1.5 * bass)

    # ---- sidechain
    pad_l *= sc
    pad_r *= sc
    bass *= np.clip(sc * 1.15, 0, 1)

    # ---- arp: delay ping-pong 3/16
    arp = hp(arp, 300)
    d = int(3 * BEAT / 4 * SR)
    arp_l = arp.copy()
    arp_r = np.zeros_like(arp)
    arp_r[d:] += arp[:-d] * 0.45
    arp_l[2 * d:] += arp[:-2 * d] * 0.25
    arp_l *= sc
    arp_r *= sc

    # ---- lặng trước drop (cắt mọi thứ trừ crash đã thêm sau)
    mix = np.zeros((N, 2))
    mix[:, 0] = drums[:, 0] * 0.85 + bass * 0.42 + pad_l * 2.4 + arp_l * 0.6
    mix[:, 1] = drums[:, 1] * 0.85 + bass * 0.42 + pad_r * 2.4 + arp_r * 0.6
    for dd in DROPS:
        a, b = int((dd - 0.25) * SR), int(dd * SR)
        ramp = int(0.02 * SR)
        mix[a:a + ramp] *= np.linspace(1, 0, ramp)[:, None]
        mix[a + ramp:b] = 0

    # ---- intro: tiếng ù trầm
    t = np.arange(int(6.0 * SR)) / SR
    drone = np.sin(2 * np.pi * 55 * t) * 0.18 + lp(rng.standard_normal(len(t)), 200) * 0.05
    drone *= np.minimum(1, t / 0.8) * np.minimum(1, (6.0 - t) / 0.5)
    mix[: len(t), 0] += drone
    mix[: len(t), 1] += drone

    # ---- kết: fade sau đòn cuối
    i = int(END_HIT * SR)
    tail = np.arange(N - i) / SR
    mix[i:] *= np.clip(1 - tail / (TOTAL - END_HIT), 0, 1)[:, None] ** 1.5
    mix[: int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))[:, None]

    # ---- master: lọc DC, nén mềm
    mix[:, 0] = hp(mix[:, 0], 28)
    mix[:, 1] = hp(mix[:, 1], 28)
    mix = np.tanh(mix * 1.1) / 1.1
    return mix


def loudness(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", out)[-1])
    pk = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", out)[-1])
    return I, pk


def main():
    os.makedirs(OUT, exist_ok=True)
    mix = build()
    path = os.path.join(OUT, "bed.wav")
    tmp = path + ".tmp.wav"
    mix = mix / np.max(np.abs(mix)) * 0.9
    wavfile.write(tmp, SR, (mix * 32767).astype(np.int16))
    I, pk = loudness(tmp)
    target = -18.0
    g = 10 ** ((target - I) / 20)
    if 20 * np.log10(np.max(np.abs(mix)) * g) > -1.0:
        g = 10 ** (-1.0 / 20) / np.max(np.abs(mix))
    mix = mix * g
    wavfile.write(path, SR, (mix * 32767).astype(np.int16))
    os.remove(tmp)
    I2, pk2 = loudness(path)
    flac = os.path.join(OUT, "bed.flac")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-c:a", "flac", "-compression_level", "8", flac], check=True)
    os.remove(path)
    print(f"bed.flac {TOTAL:.1f}s  {I2} LUFS  peak {pk2} dBFS")


if __name__ == "__main__":
    main()
