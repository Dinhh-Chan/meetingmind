import React from "react";
import { Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, MONO } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Chữ "đập" vào khung: phóng to -> co về, mờ chuyển động, bóng RGB đỏ/xanh hội tụ.
 * `at` là khung (cục bộ trong Sequence) bắt đầu.
 */
export const SlamText: React.FC<{
  at: number;
  children: React.ReactNode;
  size?: number;
  weight?: number;
  color?: string;
  style?: React.CSSProperties;
  from?: number; // hệ số phóng lúc đầu
  ghost?: number; // độ lệch RGB tối đa (px)
  out?: number; // khung bắt đầu biến mất
  outDur?: number;
  align?: "left" | "center" | "right";
  tracking?: number;
}> = ({ at, children, size = 120, weight = 900, color = C.white, style, from = 2.1, ghost = 22, out, outDur = 6, align = "center", tracking = -0.03 }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const scale = interpolate(t, [0, 4, 7, 10], [from, 0.95, 1.02, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const blur = interpolate(t, [0, 4], [14, 0], clamp);
  const op = interpolate(t, [0, 1.5], [0, 1], clamp);
  // bóng RGB: hội tụ nhanh, thỉnh thoảng giật lại
  const jitter = random(`j${at}-${Math.floor(t / 2)}`) > 0.93 ? 1 : 0;
  const g = ghost * (interpolate(t, [0, 9], [1, 0.08], clamp) + jitter * 0.5);
  let outP = 0;
  if (out !== undefined) outP = interpolate(frame, [out, out + outDur], [0, 1], clamp);
  if (outP >= 1) return null;
  const outScale = 1 + outP * 0.4;
  const outSkew = outP * 20;
  const base: React.CSSProperties = {
    fontFamily: FONT,
    fontSize: size,
    fontWeight: weight,
    letterSpacing: `${tracking}em`,
    lineHeight: 1.05,
    whiteSpace: "pre",
    textAlign: align,
  };
  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
        transform: `scale(${scale * outScale}) skewX(${outSkew}deg)`,
        filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
        opacity: op * (1 - outP),
        ...style,
      }}
    >
      {ghost > 0 ? (
        <>
          <div style={{ ...base, position: "absolute", inset: 0, color: "#ff2a55", transform: `translate(${g}px, ${-g * 0.15}px)`, mixBlendMode: "screen", opacity: 0.85 }}>
            {children}
          </div>
          <div style={{ ...base, position: "absolute", inset: 0, color: "#21e6ff", transform: `translate(${-g}px, ${g * 0.15}px)`, mixBlendMode: "screen", opacity: 0.85 }}>
            {children}
          </div>
        </>
      ) : null}
      <div style={{ ...base, position: "relative", color }}>{children}</div>
    </div>
  );
};

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>";

/** Chữ giải mã: ký tự ngẫu nhiên -> đúng chữ, lần lượt từ trái sang. */
export const DecodeText: React.FC<{ at: number; text: string; dur?: number; style?: React.CSSProperties }> = ({ at, text, dur = 18, style }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const chars = text.split("");
  return (
    <span style={style}>
      {chars.map((ch, i) => {
        const reveal = (i / chars.length) * dur;
        if (t >= reveal + 3 || ch === " ") return <span key={i}>{ch}</span>;
        if (t < reveal - 4) return <span key={i} style={{ opacity: 0 }}>{ch}</span>;
        const g = GLYPHS[Math.floor(random(`d${at}-${i}-${frame}`) * GLYPHS.length)];
        return (
          <span key={i} style={{ color: C.sky, opacity: 0.85 }}>
            {g}
          </span>
        );
      })}
    </span>
  );
};

/** Gõ chữ từng ký tự, có con trỏ nhấp nháy. */
export const TypeText: React.FC<{ at: number; text: string; cps?: number; style?: React.CSSProperties; caret?: boolean }> = ({
  at,
  text,
  cps = 0.5,
  style,
  caret = true,
}) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const n = Math.min(text.length, Math.floor(t / cps));
  const showCaret = caret && Math.floor(frame / 8) % 2 === 0;
  return (
    <span style={style}>
      {text.slice(0, n)}
      <span style={{ opacity: showCaret ? 1 : 0, color: C.primary }}>▌</span>
    </span>
  );
};

/** Nhãn đầu cảnh kiểu "01 — THU NHẬN". */
export const Kicker: React.FC<{ at: number; num: string; label: string; x?: number; y?: number; color?: string }> = ({
  at,
  num,
  label,
  x = 96,
  y = 72,
  color = C.orange,
}) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const w = interpolate(t, [0, 10], [0, 90], { ...clamp, easing: Easing.out(Easing.cubic) });
  const op = interpolate(t, [0, 4], [0, 1], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        display: "flex",
        alignItems: "center",
        gap: 18,
        opacity: op,
        background: "rgba(6,11,22,0.82)",
        padding: "12px 24px",
        borderRadius: 14,
        boxShadow: "0 12px 30px -10px rgba(0,0,0,0.6)",
      }}
    >
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30, color }}>{num}</span>
      <span style={{ width: w, height: 3, background: color, display: "inline-block" }} />
      <DecodeText at={at + 2} text={label} dur={12} style={{ fontFamily: MONO, fontWeight: 700, fontSize: 28, color: C.white, letterSpacing: "0.18em" }} />
    </div>
  );
};

/** Viên nhãn bật ra bằng spring. */
export const Chip: React.FC<{
  at: number;
  children: React.ReactNode;
  color?: string;
  bg?: string;
  size?: number;
  style?: React.CSSProperties;
  out?: number;
}> = ({ at, children, color = C.white, bg = "rgba(76,124,235,0.92)", size = 30, style, out }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - at;
  if (t < 0) return null;
  const s = spring({ frame: t, fps, config: { damping: 11, stiffness: 220, mass: 0.6 } });
  let o = 1;
  if (out !== undefined) o = interpolate(frame, [out, out + 5], [1, 0], clamp);
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: `${size * 0.42}px ${size * 0.8}px`,
        borderRadius: 999,
        background: bg,
        color,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size,
        whiteSpace: "nowrap",
        boxShadow: "0 18px 40px -12px rgba(0,0,0,0.6)",
        transform: `scale(${s})`,
        opacity: o,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
