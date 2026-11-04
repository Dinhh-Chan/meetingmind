import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AppWindow, camAt, Cam, HighlightBox, toScreen } from "../components/AppWindow";
import { Background } from "../components/Background";
import { Chip, Kicker, SlamText } from "../components/text";
import { Callout, Glass, Icon, ICONS } from "../components/ui";
import { C, FONT, MONO } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const CARDS: { at: number; n: string; icon: keyof typeof ICONS; title: string; sub: string; from: [number, number]; accent: string }[] = [
  { at: 9, n: "01", icon: "upload", title: "Tải tệp ghi âm", sub: "Kéo thả file sau buổi họp", from: [-900, 120], accent: C.sky },
  { at: 52, n: "02", icon: "bot", title: "Bot vào Google Meet", sub: "Tự vào phòng, ghi âm WebRTC", from: [0, 700], accent: C.primary },
  { at: 98, n: "03", icon: "puzzle", title: "Tiện ích Chrome", sub: "Đọc phụ đề Meet kèm tên người nói", from: [900, 120], accent: C.orange },
];

const CardsPart: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = interpolate(frame, [128, 140], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill>
      <Kicker at={0} num="01" label="THU NHẬN" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 175, textAlign: "center", opacity: 1 - exit }}>
        <SlamText at={2} size={76} weight={800} ghost={14} from={1.5}>
          3 đường đưa cuộc họp vào hệ thống
        </SlamText>
      </div>
      {CARDS.map((c, i) => {
        const t = frame - c.at;
        if (t < 0) return null;
        const s = spring({ frame: t, fps, config: { damping: 13, stiffness: 170, mass: 0.8 } });
        const x = 160 + i * 560;
        const dx = c.from[0] * (1 - s);
        const dy = c.from[1] * (1 - s) - exit * (900 + i * 120);
        const rot = (1 - s) * (i - 1) * 14 + exit * (i - 1) * 20;
        const iconPop = spring({ frame: t - 6, fps, config: { damping: 8, stiffness: 220 } });
        return (
          <div key={i} style={{ position: "absolute", left: x, top: 365, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, filter: exit > 0.05 ? `blur(${exit * 12}px)` : undefined }}>
            <Glass style={{ width: 500, height: 480, padding: 46, boxSizing: "border-box", position: "relative", overflow: "hidden" }} border={`${c.accent}66`}>
              <div style={{ position: "absolute", right: 30, top: 18, fontFamily: MONO, fontWeight: 700, fontSize: 110, color: `${c.accent}22` }}>{c.n}</div>
              <div
                style={{
                  width: 132,
                  height: 132,
                  borderRadius: 34,
                  background: `linear-gradient(135deg, ${c.accent}, ${c.accent}88)`,
                  display: "grid",
                  placeItems: "center",
                  transform: `scale(${iconPop})`,
                  boxShadow: `0 20px 50px -10px ${c.accent}aa`,
                }}
              >
                <Icon name={c.icon} size={74} color="#fff" stroke={2.2} />
              </div>
              <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 50, color: C.white, marginTop: 52, letterSpacing: "-0.02em", lineHeight: 1.12 }}>{c.title}</div>
              <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 30, color: C.muted, marginTop: 18, lineHeight: 1.35 }}>{c.sub}</div>
            </Glass>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const BOT_CAMS: Cam[] = [
  { f: 0, s: 1.2, x: 0.5, y: 0.46 },
  { f: 26, s: 1.75, x: 0.5, y: 0.42 },
  { f: 58, s: 1.85, x: 0.5, y: 0.43 },
];

const MEET_CAMS: Cam[] = [
  { f: 0, s: 1.6, x: 0.66, y: 0.6 },
  { f: 42, s: 1.8, x: 0.7, y: 0.66 },
];

const MeetingsPart: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = camAt(MEET_CAMS, frame);
  const p = toScreen(cam, 0.7125, 0.62);
  return (
    <AbsoluteFill>
      <AppWindow src="clips/meetings.mp4" trimBefore={3.3} rate={1} cams={MEET_CAMS} enterAt={-30} url="localhost:3001/meetings">
        <HighlightBox at={4} u0={0.7125} v0={0.624} u1={0.79} v1={0.65} color={C.orange} camScale={cam.s} />
        <HighlightBox at={10} u0={0.7125} v0={0.707} u1={0.79} v1={0.733} color={C.primary} camScale={cam.s} />
        <HighlightBox at={16} u0={0.7125} v0={0.79} u1={0.775} v1={0.817} color={C.sky} camScale={cam.s} />
      </AppWindow>
      <Callout at={12} x={p.x - 20} y={p.y} dx={-260} dy={-120} text="Nguồn thu nhận ghi rõ từng cuộc họp" size={30} />
    </AbsoluteFill>
  );
};

export const Capture: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />
      <Sequence durationInFrames={140}>
        <CardsPart />
      </Sequence>
      <Sequence from={140} durationInFrames={58}>
        <AbsoluteFill style={{ background: C.ink }}>
          <AppWindow src="clips/bot.mp4" trimBefore={4.0} rate={2.2} cams={BOT_CAMS} enterAt={-30} url="localhost:3001/meetings · Mời bot" />
          <Chip at={6} style={{ left: 120, top: 70 }} size={32}>
            <Icon name="bot" size={38} /> Dán link Google Meet → bot tự vào phòng
          </Chip>
        </AbsoluteFill>
      </Sequence>
      <Sequence from={198} durationInFrames={42}>
        <AbsoluteFill style={{ background: C.ink }}>
          <MeetingsPart />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
