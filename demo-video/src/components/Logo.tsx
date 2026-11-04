import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "../theme";
import { DecodeText } from "./text";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Biểu tượng MeetingMind: ô bo góc gradient #8FB3FF -> #4C7CEB, nét "M" trắng (theo logo.tsx của app). */
export const LogoMark: React.FC<{ size?: number; draw?: number; glow?: number }> = ({ size = 160, draw = 1, glow = 1 }) => {
  const len = 60;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.31,
        background: "linear-gradient(135deg, #8FB3FF 0%, #4C7CEB 100%)",
        display: "grid",
        placeItems: "center",
        boxShadow: `0 ${size * 0.1}px ${size * 0.35}px -${size * 0.08}px rgba(76,124,235,${0.75 * glow}), 0 0 ${size * 0.6}px rgba(143,179,255,${0.35 * glow})`,
      }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17V7l4.5 6L12 7l3.5 6L20 7v10" strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />
      </svg>
    </div>
  );
};

/** Lộ diện logo: ô bật spring + vẽ nét M + chữ MeetingMind giải mã trượt ra. */
export const LogoReveal: React.FC<{ at: number; size?: number; wordAt?: number; textSize?: number }> = ({ at, size = 200, wordAt, textSize = 150 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - at;
  if (t < 0) return null;
  const s = spring({ frame: t, fps, config: { damping: 9, stiffness: 160, mass: 0.7 } });
  const rot = interpolate(t, [0, 12], [-25, 0], { ...clamp, easing: Easing.out(Easing.back(2)) });
  const draw = interpolate(t, [4, 16], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const w = wordAt ?? at + 12;
  const tw = frame - w;
  const wordX = interpolate(tw, [0, 10], [-60, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const wordOp = interpolate(tw, [0, 3], [0, 1], clamp);
  const ring = interpolate(t, [0, 22], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  // Ô logo nằm giữa khung lúc đầu; khi chữ xuất hiện thì "nhảy cắt" sang trái (kèm glitch toàn khung ở timeline).
  const gap = size * 0.22;
  const wordW = textSize * 6.25;
  const markX = tw < 0 ? (wordW + gap) / 2 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap, position: "relative" }}>
      <div style={{ position: "relative", transform: `translateX(${markX}px) scale(${s}) rotate(${rot}deg)` }}>
        <div
          style={{
            position: "absolute",
            left: size / 2,
            top: size / 2,
            width: size * 4 * ring,
            height: size * 4 * ring,
            transform: "translate(-50%,-50%)",
            borderRadius: "50%",
            border: `${6 * (1 - ring) + 1}px solid ${C.sky}`,
            opacity: 1 - ring,
          }}
        />
        <LogoMark size={size} draw={draw} />
      </div>
      {(
        <div
          style={{
            width: wordW,
            fontFamily: FONT,
            fontWeight: 800,
            fontSize: textSize,
            letterSpacing: "-0.035em",
            color: C.white,
            transform: `translateX(${wordX}px)`,
            opacity: tw >= 0 ? wordOp : 0,
            whiteSpace: "nowrap",
            textShadow: "0 10px 40px rgba(76,124,235,0.45)",
          }}
        >
          <DecodeText at={w} text="MeetingMind" dur={14} />
        </div>
      )}
    </div>
  );
};
