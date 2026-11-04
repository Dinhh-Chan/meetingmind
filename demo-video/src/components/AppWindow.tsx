import React from "react";
import { Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, MONO } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Kích thước vùng nội dung (clip quay 2560x1440 -> hiển thị 1600x900) + thanh trình duyệt. */
export const CW = 1600;
export const CH = 900;
export const BAR_H = 44;

/** Khung máy quay: f = khung cục bộ, s = độ phóng, (x, y) = điểm nhìn trong nội dung (0..1). */
export type Cam = { f: number; s: number; x: number; y: number };

/** Khi phóng đủ lớn, không để lộ mép cửa sổ (tránh dải đen ở cạnh khung). */
const clampCam = (c: Cam): Cam => {
  let { x, y } = c;
  const { s } = c;
  if (s * CW >= 1920) {
    const m = 960 / (s * CW);
    x = Math.min(Math.max(x, m), 1 - m);
  }
  if (s * (CH + BAR_H) >= 1080) {
    const py = Math.min(Math.max(BAR_H + y * CH, 540 / s), BAR_H + CH - 540 / s);
    y = (py - BAR_H) / CH;
  }
  return { ...c, x, y };
};

export const camAt = (cams: Cam[], frame: number) => clampCam(camRaw(cams, frame));

const camRaw = (cams: Cam[], frame: number): Cam => {
  if (frame <= cams[0].f) return cams[0];
  for (let i = 0; i < cams.length - 1; i++) {
    const a = cams[i];
    const b = cams[i + 1];
    if (frame >= a.f && frame <= b.f) {
      const p = Easing.inOut(Easing.cubic)((frame - a.f) / Math.max(1, b.f - a.f));
      // nội suy độ phóng theo log cho chuyển động đều mắt
      const s = Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * p);
      return { f: frame, s, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
    }
  }
  return cams[cams.length - 1];
};

/** Chuyển toạ độ nội dung (u, v) -> toạ độ màn hình 1920x1080 theo camera hiện tại. */
export const toScreen = (cam: { s: number; x: number; y: number }, u: number, v: number) => {
  const px = cam.x * CW;
  const py = BAR_H + cam.y * CH;
  return { x: 960 + cam.s * (u * CW - px), y: 540 + cam.s * (BAR_H + v * CH - py) };
};

export const AppWindow: React.FC<{
  src: string;
  trimBefore: number; // giây trong clip nguồn
  rate?: number;
  cams: Cam[];
  url?: string;
  enterAt?: number;
  /** vẽ thêm trong hệ toạ độ nội dung (px trên 1600x900) */
  children?: React.ReactNode;
  dim?: number;
}> = ({ src, trimBefore, rate = 1, cams, url = "localhost:3001", enterAt = 0, children, dim = 0 }) => {
  const frame = useCurrentFrame();
  const cam = camAt(cams, frame);
  const px = cam.x * CW;
  const py = BAR_H + cam.y * CH;
  const te = frame - enterAt;
  const enter = interpolate(te, [0, 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const rotX = (1 - enter) * 28;
  const ty = (1 - enter) * 260;
  const op = interpolate(te, [0, 4], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 1600, opacity: op }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: CW,
          height: CH + BAR_H,
          transformOrigin: "0 0",
          transform: `translate(${960 - cam.s * px}px, ${540 - cam.s * py + ty}px) scale(${cam.s})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 18,
            overflow: "hidden",
            background: "#fff",
            transform: `rotateX(${rotX}deg)`,
            transformOrigin: "50% 100%",
            boxShadow: "0 60px 120px -30px rgba(0,0,0,0.85), 0 0 0 1.5px rgba(143,179,255,0.35), 0 0 80px rgba(76,124,235,0.25)",
          }}
        >
          <div style={{ height: BAR_H, background: "#E9EEF8", display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderBottom: "1px solid #d5dcea" }}>
            {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
              <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c, display: "inline-block" }} />
            ))}
            <div
              style={{
                marginLeft: 22,
                flex: 1,
                maxWidth: 760,
                height: 28,
                borderRadius: 8,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                padding: "0 14px",
                fontFamily: MONO,
                fontSize: 15,
                color: "#56627a",
              }}
            >
              🔒 {url}
            </div>
          </div>
          <div style={{ position: "relative", width: CW, height: CH }}>
            <OffthreadVideo
              src={staticFile(src)}
              trimBefore={Math.round(trimBefore * 30)}
              playbackRate={rate}
              muted
              style={{ width: CW, height: CH, display: "block" }}
            />
            {dim > 0 ? <div style={{ position: "absolute", inset: 0, background: `rgba(6,11,22,${dim})` }} /> : null}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

/** Khung chữ nhật vẽ dần quanh vùng (toạ độ chuẩn hoá u,v trong nội dung). */
export const HighlightBox: React.FC<{
  at: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  color?: string;
  out?: number;
  camScale?: number;
  label?: string;
}> = ({ at, u0, v0, u1, v1, color = C.orange, out, camScale = 1, label }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  let o = interpolate(t, [0, 3], [0, 1], clamp);
  if (out !== undefined) o *= interpolate(frame, [out, out + 5], [1, 0], clamp);
  if (o <= 0) return null;
  const x = u0 * CW;
  const y = v0 * CH;
  const w = (u1 - u0) * CW;
  const h = (v1 - v0) * CH;
  const per = 2 * (w + h);
  const draw = interpolate(t, [0, 9], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const sw = 4 / camScale;
  const pad = 6 / camScale;
  return (
    <svg style={{ position: "absolute", left: x - pad, top: y - pad, overflow: "visible", opacity: o }} width={w + 2 * pad} height={h + 2 * pad}>
      <rect x={sw / 2} y={sw / 2} width={w + 2 * pad - sw} height={h + 2 * pad - sw} rx={10 / camScale} fill={`${color}14`} stroke={color} strokeWidth={sw} strokeDasharray={per} strokeDashoffset={per * (1 - draw)} />
      {label ? (
        <text x={0} y={-10 / camScale} fill={color} fontFamily={FONT} fontWeight={800} fontSize={18 / camScale}>
          {label}
        </text>
      ) : null}
    </svg>
  );
};
