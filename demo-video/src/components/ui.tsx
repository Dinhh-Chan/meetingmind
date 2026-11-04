import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Chú thích: chấm ở điểm neo + đường dẫn + nhãn (toạ độ màn hình). */
export const Callout: React.FC<{
  at: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  text: React.ReactNode;
  sub?: React.ReactNode;
  color?: string;
  out?: number;
  size?: number;
}> = ({ at, x, y, dx, dy, text, sub, color = C.orange, out, size = 30 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - at;
  if (t < 0) return null;
  let o = 1;
  if (out !== undefined) o = interpolate(frame, [out, out + 5], [1, 0], clamp);
  if (o <= 0) return null;
  const dot = spring({ frame: t, fps, config: { damping: 10, stiffness: 260 } });
  const line = interpolate(t, [2, 9], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const lab = spring({ frame: t - 6, fps, config: { damping: 12, stiffness: 200, mass: 0.7 } });
  const lx = x + dx;
  const ly = y + dy;
  const len = Math.hypot(dx, dy);
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const left = dx < 0;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: x - 11,
          top: y - 11,
          width: 22,
          height: 22,
          borderRadius: 11,
          background: color,
          transform: `scale(${dot})`,
          boxShadow: `0 0 0 ${8 * dot}px ${color}44`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x,
          top: y - 2,
          width: len * line,
          height: 4,
          background: color,
          transformOrigin: "0 50%",
          transform: `rotate(${ang}deg)`,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: left ? undefined : lx,
          right: left ? 1920 - lx : undefined,
          top: ly,
          transform: `translateY(-50%) scale(${lab})`,
          transformOrigin: left ? "100% 50%" : "0% 50%",
          background: "rgba(8,14,30,0.92)",
          border: `2.5px solid ${color}`,
          borderRadius: 16,
          padding: "14px 24px",
          color: C.white,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: size,
          whiteSpace: "nowrap",
          boxShadow: `0 20px 50px -10px rgba(0,0,0,0.7), 0 0 30px ${color}44`,
        }}
      >
        {text}
        {sub ? <div style={{ fontWeight: 500, fontSize: size * 0.62, color: C.muted, marginTop: 4 }}>{sub}</div> : null}
      </div>
    </div>
  );
};

/** Bảng kính mờ dùng chung. */
export const Glass: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode; border?: string }> = ({ style, children, border = "rgba(143,179,255,0.28)" }) => (
  <div
    style={{
      background: "linear-gradient(160deg, rgba(31,58,95,0.72), rgba(10,20,40,0.82))",
      border: `1.5px solid ${border}`,
      borderRadius: 28,
      boxShadow: "0 40px 80px -30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Định dạng số kiểu Việt Nam (dấu phẩy thập phân). */
export const viNum = (v: number, decimals = 0) => v.toFixed(decimals).replace(".", ",");

/** Bộ đếm: chạy từ `from` tới `to` trong `dur` khung. */
export const useCount = (at: number, dur: number, to: number, from = 0) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - at, [0, dur], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  return from + (to - from) * p;
};

export const Icon: React.FC<{ name: keyof typeof ICONS; size?: number; color?: string; stroke?: number }> = ({ name, size = 64, color = C.white, stroke = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    {ICONS[name]}
  </svg>
);

export const ICONS = {
  upload: (
    <>
      <path d="M12 15V3" />
      <path d="m7 8 5-5 5 5" />
      <path d="M20 15v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
    </>
  ),
  bot: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 8V4" />
      <circle cx="12" cy="3" r="1" />
      <path d="M9 13v2M15 13v2" />
      <path d="M2 13v3M22 13v3" />
    </>
  ),
  puzzle: (
    <>
      <path d="M19.4 13.6a2 2 0 0 0 0-3.2L18 9.4V7a1 1 0 0 0-1-1h-2.4l-1-1.4a2 2 0 0 0-3.2 0l-1 1.4H7a1 1 0 0 0-1 1v2.4l-1.4 1a2 2 0 0 0 0 3.2l1.4 1V17a1 1 0 0 0 1 1h2.4l1 1.4a2 2 0 0 0 3.2 0l1-1.4H17a1 1 0 0 0 1-1v-2.4z" />
    </>
  ),
  pen: (
    <>
      <path d="M12 20h9" />
      <path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  missing: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
  swap: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21v-2a4 4 0 0 1 4-4h6" />
      <path d="m16 15 3 3-3 3" />
      <path d="M22 18h-7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  mic: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4" />
    </>
  ),
  sparkle: <path d="M12 3l1.9 5.6L19.5 10.5 13.9 12.4 12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />,
  quote: (
    <>
      <path d="M7 7h4v4c0 3-1.5 5-4 6" />
      <path d="M14 7h4v4c0 3-1.5 5-4 6" />
    </>
  ),
  send: (
    <>
      <path d="m22 2-7 20-4-9-9-4z" />
      <path d="M22 2 11 13" />
    </>
  ),
  layers: (
    <>
      <path d="m12 2 10 5-10 5L2 7z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </>
  ),
};
