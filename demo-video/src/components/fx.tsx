import { noise2D } from "@remotion/noise";
import React from "react";
import { AbsoluteFill, interpolate, random } from "remotion";
import { GLITCHES, HITS } from "../timeline";

/** Rung máy quay + phóng giật theo danh sách HITS. */
export const cameraAt = (frame: number) => {
  let x = 0;
  let y = 0;
  let rot = 0;
  let scale = 1;
  HITS.forEach((h, i) => {
    const d = frame - h.f;
    if (d < 0 || d > 24) return;
    const k = Math.exp(-d / 5);
    x += h.shake * k * noise2D(`sx${i}`, d * 0.55, 0);
    y += h.shake * k * noise2D(`sy${i}`, d * 0.55, 1);
    rot += h.shake * 0.035 * k * noise2D(`sr${i}`, d * 0.4, 2);
    if (h.zoom) scale += h.zoom * Math.exp(-d / 4);
  });
  return { x, y, rot, scale };
};

export const flashAt = (frame: number) => {
  let a = 0;
  HITS.forEach((h) => {
    if (!h.flash) return;
    const d = frame - h.f;
    if (d < 0 || d > 8) return;
    a = Math.max(a, h.flash * Math.exp(-d / 1.6));
  });
  return a;
};

export const glitchAt = (frame: number) => {
  let a = 0;
  GLITCHES.forEach((g) => {
    const d = frame - g.f;
    if (d < 0 || d >= g.dur) return;
    // nhấp nháy bật/tắt kiểu giật
    const on = random(`g${g.f}-${d}`) > 0.25 ? 1 : 0.25;
    const env = 1 - (d / g.dur) * 0.5;
    a = Math.max(a, g.amt * on * env);
  });
  return a;
};

/**
 * Bộ lọc SVG: dịch các dải ngang (displacement theo nhiễu bậc thang) + tách kênh RGB.
 * Áp cho cả khung (kể cả video) khi glitch > 0.
 */
export const GlitchDefs: React.FC<{ frame: number; amount: number }> = ({ frame, amount }) => {
  const seed = Math.floor(random(`seed${frame}`) * 1000);
  const split = 4 + 26 * amount;
  const disp = 140 * amount;
  const bandY = 0.012 + random(`by${frame}`) * 0.05;
  return (
    <svg width={0} height={0} style={{ position: "absolute" }}>
      <defs>
        <filter id="mmGlitch" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency={`0.00001 ${bandY}`} numOctaves={1} seed={seed} result="t" />
          <feComponentTransfer in="t" result="bands">
            <feFuncR type="discrete" tableValues="0.5 0.5 0.15 0.5 0.85 0.5 0.5 0.3 0.5 0.7" />
          </feComponentTransfer>
          <feColorMatrix in="bands" type="matrix" values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={disp} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
          <feOffset in="r" dx={split} dy={0} result="ro" />
          <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
          <feOffset in="gb" dx={-split * 0.7} dy={0} result="gbo" />
          <feBlend in="ro" in2="gbo" mode="screen" />
        </filter>
      </defs>
    </svg>
  );
};

/** Các khối nhiễu màu + vạch quét khi glitch. */
export const GlitchBlocks: React.FC<{ frame: number; amount: number }> = ({ frame, amount }) => {
  if (amount < 0.05) return null;
  const n = Math.round(3 + amount * 9);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      {new Array(n).fill(0).map((_, i) => {
        const y = random(`by${frame}-${i}`) * 1080;
        const h = 4 + random(`bh${frame}-${i}`) * 40;
        const x = random(`bx${frame}-${i}`) * 1500;
        const w = 120 + random(`bw${frame}-${i}`) * 700;
        const col = ["#ff2a55", "#21e6ff", "#ffffff", "#4C7CEB"][Math.floor(random(`bc${frame}-${i}`) * 4)];
        return (
          <div
            key={i}
            style={{ position: "absolute", left: x, top: y, width: w, height: h, background: col, opacity: 0.18 + 0.4 * amount * random(`bo${frame}-${i}`) }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const Flash: React.FC<{ amount: number }> = ({ amount }) =>
  amount > 0.01 ? <AbsoluteFill style={{ background: "#fff", opacity: Math.min(1, amount), pointerEvents: "none" }} /> : null;

/** Hạt phim + vignette + vạch quét nhẹ. */
export const Grain: React.FC<{ frame: number; opacity?: number }> = ({ frame, opacity = 0.07 }) => {
  const seed = frame % 13;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", opacity, mixBlendMode: "overlay" }}>
        <filter id={`grain${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain${seed})`} />
      </svg>
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

export const Scanlines: React.FC<{ opacity?: number }> = ({ opacity = 0.08 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      opacity,
      backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 4px)",
    }}
  />
);

/** Phủ chuyển cảnh: màn trập chéo quét qua (dùng ở cuối/đầu cảnh). */
export const Wipe: React.FC<{ frame: number; at: number; dur?: number; color?: string; dir?: 1 | -1 }> = ({
  frame,
  at,
  dur = 10,
  color = "#4C7CEB",
  dir = 1,
}) => {
  const p = interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (p <= 0 || p >= 1) return null;
  const x = interpolate(p, [0, 1], [-130, 130]) * dir;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: `${x}%`,
          top: "-20%",
          width: "60%",
          height: "140%",
          transform: "skewX(-18deg)",
          background: `linear-gradient(90deg, transparent, ${color} 30%, #fff 50%, ${color} 70%, transparent)`,
          opacity: 0.9,
        }}
      />
    </AbsoluteFill>
  );
};
