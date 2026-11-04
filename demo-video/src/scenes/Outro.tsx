import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { LogoReveal } from "../components/Logo";
import { SlamText } from "../components/text";
import { C, FONT, MONO } from "../theme";
import { Burst } from "./LogoScene";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const CREDITS: { at: number; text: string; style: React.CSSProperties }[] = [
  { at: 110, text: "Đề tài NCKH 18-SV-2026-RIPT", style: { fontFamily: MONO, fontWeight: 700, fontSize: 30, color: C.orange, letterSpacing: "0.08em" } },
  { at: 118, text: "Học viện Công nghệ Bưu chính Viễn thông", style: { fontFamily: FONT, fontWeight: 600, fontSize: 40, color: C.white } },
  { at: 126, text: "Trần Đức Định · Hoàng Nguyễn Trà My", style: { fontFamily: FONT, fontWeight: 800, fontSize: 46, color: C.white } },
  { at: 134, text: "GVHD: TS. Lê Văn Hoàng", style: { fontFamily: FONT, fontWeight: 600, fontSize: 36, color: C.muted } },
];

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const up = interpolate(frame, [96, 112], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const endPulse = interpolate(frame, [240, 244, 252], [1, 1.08, 1], clamp);
  const fade = interpolate(frame, [278, 326], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  return (
    <AbsoluteFill>
      <Background intensity={1.1} />
      <Burst frame={frame} at={0} n={32} />
      <Burst frame={frame} at={240} n={24} color={C.orange} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform: `translateY(${-40 - up * 170}px) scale(${(1 - up * 0.22) * endPulse})` }}>
        <LogoReveal at={0} size={190} wordAt={14} textSize={156} />
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform: `translateY(${150 - up * 210}px)` }}>
        <SlamText at={62} size={62} weight={800} ghost={14} from={1.6}>
          Họp xong — việc đã <span style={{ color: C.orange }}>vào guồng</span>.
        </SlamText>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ marginTop: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          {CREDITS.map((c) => {
            const t = frame - c.at;
            if (t < 0) return <div key={c.text} style={{ ...c.style, opacity: 0 }}>{c.text}</div>;
            const s = spring({ frame: t, fps, config: { damping: 14, stiffness: 160 } });
            return (
              <div key={c.text} style={{ ...c.style, opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
                {c.text}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#000", opacity: fade }} />
    </AbsoluteFill>
  );
};
