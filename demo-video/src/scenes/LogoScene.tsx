import React from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { Background } from "../components/Background";
import { LogoReveal } from "../components/Logo";
import { SlamText } from "../components/text";
import { Icon } from "../components/ui";
import { C, FONT } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Tia sáng bắn ra từ tâm lúc drop. */
export const Burst: React.FC<{ frame: number; at: number; n?: number; color?: string }> = ({ frame, at, n = 28, color = C.sky }) => {
  const t = frame - at;
  if (t < 0 || t > 26) return null;
  const p = interpolate(t, [0, 26], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill>
      {new Array(n).fill(0).map((_, i) => {
        const a = (i / n) * Math.PI * 2 + random(`ba${at}${i}`) * 0.3;
        const r0 = 120 + 900 * p * (0.6 + 0.4 * random(`br${at}${i}`));
        const len = 140 * (1 - p) + 20;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 960 + Math.cos(a) * r0,
              top: 540 + Math.sin(a) * r0,
              width: len,
              height: 4,
              background: i % 3 === 0 ? C.orange : color,
              transform: `rotate(${(a * 180) / Math.PI}deg)`,
              transformOrigin: "0 50%",
              opacity: 1 - p,
              borderRadius: 2,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const LogoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const zoomOut = interpolate(frame, [104, 120], [1, 3.2], { ...clamp, easing: Easing.in(Easing.cubic) });
  const blur = interpolate(frame, [106, 120], [0, 18], clamp);
  const drift = interpolate(frame, [0, 104], [1.06, 1], { ...clamp, easing: Easing.out(Easing.quad) });
  const flow = interpolate(frame, [58, 72], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill>
      <Background intensity={1} />
      <Burst frame={frame} at={0} />
      <AbsoluteFill style={{ transform: `scale(${zoomOut * drift})`, filter: blur > 0.5 ? `blur(${blur}px)` : undefined }}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ transform: "translateY(-70px)" }}>
            <LogoReveal at={0} size={210} wordAt={18} textSize={168} />
          </div>
        </AbsoluteFill>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ transform: "translateY(150px)", display: "flex", alignItems: "center", gap: 34 }}>
            <SlamText at={40} size={58} weight={800} color={C.white} ghost={12} from={1.6}>
              <span style={{ background: C.primary, padding: "8px 26px", borderRadius: 18 }}>Trợ lý họp AI</span>
            </SlamText>
            {frame >= 40 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: FONT, fontWeight: 700, fontSize: 52, color: C.white, opacity: frame >= 56 ? flow : 0, transform: `translateX(${(1 - flow) * 60}px)` }}>
                <span style={{ color: C.muted }}>·</span>
                <Icon name="mic" size={52} color={C.sky} stroke={2.4} />
                <span>từ âm thanh</span>
                <svg width={120} height={30} style={{ overflow: "visible" }}>
                  <line x1={0} y1={15} x2={110 * flow} y2={15} stroke={C.orange} strokeWidth={5} strokeLinecap="round" />
                  <path d={`M${110 * flow - 14} 3 L${110 * flow} 15 L${110 * flow - 14} 27`} stroke={C.orange} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>đến công việc</span>
                <Icon name="check" size={52} color={C.green} stroke={3} />
              </div>
            ) : null}
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
