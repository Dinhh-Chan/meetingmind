"""Tổng hợp hiệu ứng âm thanh (SFX) bằng numpy/scipy -> public/sfx/*.wav (48 kHz, stereo, 16-bit).

Không dùng mẫu âm thanh tải về: mọi tiếng đều sinh từ sóng sin, nhiễu và bộ lọc.

  python gen_sfx.py
"""
import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "sfx")
rng = np.random.default_rng(7)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def noise(dur, seed=None):
    r = np.random.default_rng(seed) if seed is not None else rng
    return r.standard_normal(int(dur * SR))


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def tv_band(x, fc, bw_oct=1.0, n=1024, hop=256):
    """Lọc dải thông có tần số trung tâm thay đổi theo thời gian (STFT, mặt nạ Gauss theo log-tần số)."""
    fc = np.asarray(fc, dtype=float)
    win = np.hanning(n)
    pad = np.concatenate([np.zeros(n), x, np.zeros(n)])
    out = np.zeros_like(pad)
    norm = np.zeros_like(pad)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    lf = np.log2(np.maximum(freqs, 1.0))
    for start in range(0, len(pad) - n, hop):
        idx = min(max(start - n + n // 2, 0), len(fc) - 1)
        c = np.log2(max(fc[idx], 20.0))
        mask = np.exp(-0.5 * ((lf - c) / (bw_oct / 2)) ** 2)
        seg = pad[start:start + n] * win
        y = np.fft.irfft(np.fft.rfft(seg) * mask, n)
        out[start:start + n] += y * win
        norm[start:start + n] += win ** 2
    out = out / np.maximum(norm, 1e-6)
    return out[n:n + len(x)]


def env_exp(t, tau):
    return np.exp(-t / tau)


def fade(x, fin=0.002, fout=0.01):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def stereo(x, pan=0.0, width=0.0, seed=1):
    """pan -1..1 (mảng hoặc số). width: trộn thêm bản trễ nhẹ để rộng hơn."""
    pan = np.broadcast_to(np.asarray(pan, dtype=float), x.shape)
    l = x * np.cos((pan + 1) * np.pi / 4)
    r = x * np.sin((pan + 1) * np.pi / 4)
    if width:
        d = int(0.011 * SR)
        r = r * (1 - width) + np.concatenate([np.zeros(d), r[:-d]]) * width
        l = l * (1 - width / 2) + np.concatenate([np.zeros(d // 2), l[:-d // 2]]) * width / 2
    return np.stack([l, r], axis=1)


def reverb(x, dur=0.8, mix=0.25, seed=3, damp=4000):
    """Phản hồi xung = nhiễu tắt dần (lọc thấp) -> tích chập FFT, cho từng kênh."""
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    outs = []
    for ch in range(x.shape[1]):
        ir = r.standard_normal(n) * np.exp(-t / (dur / 5))
        ir = lp(ir, damp)
        ir /= np.sqrt(np.sum(ir ** 2))
        L = len(x) + n
        y = np.fft.irfft(np.fft.rfft(x[:, ch], L) * np.fft.rfft(ir, L), L)
        outs.append(y)
    wet = np.stack(outs, axis=1) * mix
    dry = np.concatenate([x, np.zeros((n, x.shape[1]))])
    return dry + wet


def save(name, x, peak_db=-1.5):
    if x.ndim == 1:
        x = stereo(x)
    x = x - np.mean(x, axis=0)
    pk = np.max(np.abs(x))
    x = x / pk * (10 ** (peak_db / 20))
    # bỏ đuôi gần như im lặng
    mag = np.max(np.abs(x), axis=1)
    nz = np.where(mag > 10 ** (-70 / 20))[0]
    if len(nz):
        x = x[: nz[-1] + 1]
    x[-int(0.003 * SR):] *= np.linspace(1, 0, int(0.003 * SR))[:, None]
    wavfile.write(os.path.join(OUT, name + ".wav"), SR, (x * 32767).astype(np.int16))
    print(f"{name:14s} {len(x) / SR:5.2f}s  peak {peak_db} dBFS")


# ---------------------------------------------------------------- tiếng cụ thể

def whoosh(dur=0.7, f0=250, f1=4500, f2=900, peak=0.6, seed=11, pan_from=-0.8, pan_to=0.8):
    t = t_axis(dur)
    x = noise(dur, seed)
    p = t / dur
    fc = np.where(p < peak, f0 * (f1 / f0) ** (p / peak), f1 * (f2 / f1) ** ((p - peak) / (1 - peak)))
    y = tv_band(x, fc, bw_oct=1.3)
    env = np.where(p < peak, (p / peak) ** 2.2, np.exp(-(p - peak) / (1 - peak) * 4.0))
    y = y * env
    pan = pan_from + (pan_to - pan_from) * p
    return stereo(fade(y, 0.005, 0.02), pan, width=0.3)


def swoosh_rev(dur=1.2):
    t = t_axis(dur)
    x = hp(noise(dur, 21), 1800) * env_exp(t, 0.35) + 0.4 * bp(noise(dur, 22), 500, 2000) * env_exp(t, 0.2)
    s = reverb(stereo(x, 0, width=0.6), 1.0, 0.5)[: len(t)]
    s = s[::-1].copy()
    s *= np.linspace(0.0, 1.0, len(s))[:, None] ** 1.5
    return s


def kick_body(dur=0.5, f_hi=160, f_lo=42, tau_p=0.04, tau_a=0.3):
    t = t_axis(dur)
    f = f_lo + (f_hi - f_lo) * np.exp(-t / tau_p)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env_exp(t, tau_a)


def impact(dur=1.8):
    t = t_axis(dur)
    sub = kick_body(dur, 110, 34, 0.12, 0.55) * 1.0
    crack = hp(noise(dur, 31), 900) * env_exp(t, 0.035) * 0.55
    thump = lp(noise(dur, 32), 180) * env_exp(t, 0.18) * 1.2
    rumble = lp(noise(dur, 33), 120) * env_exp(t, 0.6) * 0.5
    x = np.tanh(1.8 * (sub + crack + thump + rumble))
    s = stereo(x, 0, width=0.4)
    s = reverb(s, 1.4, 0.18, damp=2500)[: len(t)]
    return s


def hit(dur=0.7):
    t = t_axis(dur)
    k = kick_body(dur, 190, 48, 0.03, 0.16)
    snap = bp(noise(dur, 41), 1200, 7000) * env_exp(t, 0.025) * 0.8
    body = bp(noise(dur, 42), 150, 900) * env_exp(t, 0.06) * 0.6
    x = np.tanh(2.2 * (k + snap + body))
    return reverb(stereo(x, 0, width=0.3), 0.6, 0.15)[: len(t)]


def glitch(dur=0.45, seed=51, crush_bits=(3, 6)):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    out = np.zeros(n)
    pos = 0
    while pos < n:
        g = int(r.uniform(0.012, 0.045) * SR)
        reps = r.integers(1, 4)
        kind = r.integers(0, 4)
        tt = np.arange(g) / SR
        if kind == 0:   # vuông tần số ngẫu nhiên
            f = r.uniform(150, 2500)
            grain = np.sign(np.sin(2 * np.pi * f * tt))
        elif kind == 1:  # nhiễu
            grain = r.standard_normal(g)
        elif kind == 2:  # quét sin
            f = r.uniform(200, 3000) * np.exp(np.linspace(0, r.uniform(-2, 2), g))
            grain = np.sin(2 * np.pi * np.cumsum(f) / SR)
        else:          # im lặng (khoảng ngắt)
            grain = np.zeros(g)
        # sample-and-hold + bit crush
        hold = r.integers(4, 40)
        grain = np.repeat(grain[::hold], hold)[:g]
        bits = r.integers(crush_bits[0], crush_bits[1] + 1)
        q = 2 ** bits
        grain = np.round(grain * q / 2) / (q / 2)
        grain *= r.uniform(0.4, 1.0)
        for _ in range(reps):
            if pos >= n:
                break
            seg = grain[: n - pos]
            out[pos:pos + len(seg)] += seg
            pos += len(seg)
    out = hp(out, 120)
    pan = np.repeat(r.uniform(-0.7, 0.7, n // 1200 + 1), 1200)[:n]
    return stereo(fade(out, 0.001, 0.01), pan)


def click():
    dur = 0.06
    t = t_axis(dur)
    x = bp(noise(dur, 61), 2000, 6000) * env_exp(t, 0.0025) + 0.5 * np.sin(2 * np.pi * 1500 * t) * env_exp(t, 0.006)
    return stereo(x)


def pop():
    dur = 0.18
    t = t_axis(dur)
    f = 260 + 700 * np.exp(-t / 0.018)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(t, 0.045)
    x += 0.2 * bp(noise(dur, 62), 2000, 8000) * env_exp(t, 0.003)
    return stereo(x)


def tick():
    dur = 0.04
    t = t_axis(dur)
    x = hp(noise(dur, 71), 3500) * env_exp(t, 0.0015) + 0.6 * np.sin(2 * np.pi * 3800 * t) * env_exp(t, 0.004)
    return stereo(x)


def riser(dur=4.0, seed=81):
    t = t_axis(dur)
    p = t / dur
    nz = tv_band(noise(dur, seed), 350 * (9000 / 350) ** p, bw_oct=1.6)
    nz *= p ** 2.2
    f = 110 * 2 ** (2.2 * p ** 1.4)
    vib = 1 + 0.01 * np.sin(2 * np.pi * (5 + 10 * p) * t)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    tone = 0.0
    for k, a in [(1, 1.0), (2, 0.5), (3, 0.33), (4, 0.25), (5, 0.2)]:
        tone = tone + a * np.sin(k * ph)
    for det in (1.007, 0.993):
        tone = tone + 0.5 * np.sin(2 * np.pi * np.cumsum(f * det) / SR)
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * np.cumsum(4 + 18 * p ** 2) / SR)
    tone = lp(tone, 3000) * p ** 1.8 * trem
    x = nz * 1.2 + tone * 0.35
    s = stereo(x, 0, width=0.5)
    s[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))[:, None]
    return s


def bassdrop(dur=3.0):
    t = t_axis(dur)
    f = 26 + 60 * np.exp(-t / 0.55)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.minimum(1, t / 0.004) * env_exp(t, 1.1)
    x = np.tanh(2.5 * x) * 0.9
    x = lp(x, 260) + 0.25 * lp(np.tanh(4 * x), 900)
    hitx = np.zeros_like(t)
    h = hit(0.7)[:, 0]
    hitx[: len(h)] = h * 0.45
    return stereo(x + hitx, 0, width=0.15)


def shutter():
    dur = 0.32
    t = t_axis(dur)
    x = hp(noise(dur, 91), 2500) * env_exp(t, 0.004)
    whirr = bp(noise(dur, 92), 900, 4000) * ((t > 0.012) & (t < 0.07)) * 0.35
    c2 = np.zeros_like(t)
    i = int(0.085 * SR)
    c2[i:] = (hp(noise(dur, 93), 2000) * env_exp(t, 0.005))[: len(t) - i] * 0.8
    thunk = np.sin(2 * np.pi * 180 * t) * env_exp(t, 0.02) * 0.4
    return reverb(stereo(x + whirr + c2 + thunk, 0, width=0.2), 0.4, 0.12)[: len(t)]


def notif():
    dur = 0.9
    t = t_axis(dur)
    x = np.zeros_like(t)
    for start, f in [(0.0, 1174.66), (0.085, 1567.98)]:
        i = int(start * SR)
        tt = t[: len(t) - i]
        tone = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt) + 0.1 * np.sin(2 * np.pi * 3.01 * f * tt))
        x[i:] += tone * env_exp(tt, 0.22) * np.minimum(1, tt / 0.002)
    return reverb(stereo(x, 0, width=0.3), 0.7, 0.2)[: len(t)]


def typekey(seed):
    dur = 0.05
    t = t_axis(dur)
    x = bp(noise(dur, seed), 1500, 7000) * env_exp(t, 0.004) + 0.3 * lp(noise(dur, seed + 1), 600) * env_exp(t, 0.01)
    return stereo(x, (seed % 5 - 2) * 0.1)


def stutter_hit():
    """Đòn đánh + lặp vấp (stutter) — dùng cho chữ đập kiểu giật."""
    h = hit(0.5)
    n = int(0.06 * SR)
    seg = h[:n]
    parts = [seg, seg * 0.8, seg * 0.6, h]
    return np.concatenate(parts)


def bleep():
    dur = 0.12
    t = t_axis(dur)
    x = np.sign(np.sin(2 * np.pi * 1800 * t)) * env_exp(t, 0.03) * 0.5
    return stereo(lp(x, 6000))


def main():
    os.makedirs(OUT, exist_ok=True)
    save("whoosh", whoosh(), -3)
    save("whoosh_fast", whoosh(0.35, 400, 6000, 1500, 0.55, seed=12, pan_from=0.7, pan_to=-0.7), -3)
    save("whoosh_low", whoosh(0.9, 120, 1800, 300, 0.6, seed=13, pan_from=-0.3, pan_to=0.3), -3)
    save("swoosh_rev", swoosh_rev(), -3)
    save("impact", impact(), -1)
    save("hit", hit(), -1.5)
    save("stutter_hit", stutter_hit(), -1.5)
    save("glitch1", glitch(0.42, 51), -4)
    save("glitch2", glitch(0.3, 52), -4)
    save("glitch3", glitch(0.6, 53, (2, 5)), -4)
    save("click", click(), -6)
    save("pop", pop(), -4)
    save("tick", tick(), -6)
    save("riser4", riser(4.0, 81), -2)
    save("riser2", riser(2.0, 82), -2)
    save("bassdrop", bassdrop(), -1)
    save("shutter", shutter(), -4)
    save("notif", notif(), -4)
    save("bleep", bleep(), -8)
    for i in range(4):
        save(f"key{i}", typekey(100 + i * 7), -10)


if __name__ == "__main__":
    main()
