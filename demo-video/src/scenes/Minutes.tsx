import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { AppWindow, camAt, Cam, HighlightBox, toScreen } from "../components/AppWindow";
import { Background } from "../components/Background";
import { JsonPanel } from "../components/mocks";
import { Kicker, SlamText } from "../components/text";
import { Callout } from "../components/ui";
import { C, FONT } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// --- A: tab Biên bản (minutes.mp4: bấm tab ở 1,64 s)
const MIN_CAMS: Cam[] = [
  { f: 0, s: 0.95, x: 0.5, y: 0.5 },
  { f: 14, s: 1.0, x: 0.5, y: 0.5 },
  { f: 36, s: 1.5, x: 0.43, y: 0.53 },
  { f: 60, s: 1.58, x: 0.43, y: 0.55 },
];

const MinutesPart: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = camAt(MIN_CAMS, frame);
  const p = toScreen(cam, 0.27, 0.386);
  return (
    <AbsoluteFill>
      <AppWindow src="clips/minutes.mp4" trimBefore={1.0} rate={1.6} cams={MIN_CAMS} url="localhost:3001/meetings/6aeb5e80…  ·  Biên bản">
        <HighlightBox at={26} u0={0.236} v0={0.373} u1={0.272} v1={0.399} color={C.ai} camScale={cam.s} />
        <HighlightBox at={30} u0={0.251} v0={0.658} u1={0.288} v1={0.684} color={C.ai} camScale={cam.s} />
        <HighlightBox at={34} u0={0.269} v0={0.847} u1={0.306} v1={0.873} color={C.ai} camScale={cam.s} />
      </AppWindow>
      <Callout at={24} x={p.x + 10} y={p.y} dx={420} dy={-150} color={C.ai} text="✦ AI sinh biên bản nháp" sub="tóm tắt · quyết định · vấn đề còn mở" />
      <Kicker at={2} num="03" label="AI VIẾT BIÊN BẢN" y={60} />
    </AbsoluteFill>
  );
};

// --- B: JSON có cấu trúc
const JsonPart: React.FC = () => {
  const frame = useCurrentFrame();
  const morph = interpolate(frame, [30, 40], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const enter = interpolate(frame, [0, 6], [0.85, 1], { ...clamp, easing: Easing.out(Easing.back(2)) });
  return (
    <AbsoluteFill>
      <Background tint={C.ai} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ transform: `scale(${enter * (1 - morph * 0.7)}) translate(${morph * 600}px, ${morph * -200}px)`, opacity: 1 - morph }}>
          <JsonPanel at={0} cps={0.75} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// --- C: hàng đợi duyệt (hero_review.mp4: rê câu trích 1,87 s, rê tiêu đề 3,99 s)
const REV_CAMS: Cam[] = [
  { f: 0, s: 1.0, x: 0.5, y: 0.5 },
  { f: 16, s: 1.45, x: 0.6, y: 0.43 },
  { f: 110, s: 1.42, x: 0.56, y: 0.46 },
  { f: 140, s: 1.62, x: 0.31, y: 0.53 },
  { f: 200, s: 1.66, x: 0.3, y: 0.54 },
];

const ReviewPart: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = camAt(REV_CAMS, frame);
  const q = toScreen(cam, 0.595, 0.37);
  const btn = toScreen(cam, 0.39, 0.582);
  const bannerOut = interpolate(frame, [104, 112], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <AppWindow src="clips/hero_review.mp4" trimBefore={0} rate={0.8} cams={REV_CAMS} enterAt={-30} url="localhost:3001/work/review  ·  Task cần duyệt">
        <HighlightBox at={4} out={104} u0={0.592} v0={0.348} u1={0.89} v1={0.392} color={C.orange} camScale={cam.s} />
        <HighlightBox at={120} u0={0.193} v0={0.563} u1={0.393} v1={0.602} color={C.green} camScale={cam.s} />
      </AppWindow>
      <Callout at={6} out={104} x={q.x} y={q.y + 8} dx={60} dy={230} text="Câu trích nguồn" sub="mỗi đề xuất kèm lời gốc trong transcript" />
      <Callout at={124} x={btn.x + 8} y={btn.y} dx={300} dy={150} color={C.green} text="Duyệt · Sửa · Loại" sub="quyết định cuối thuộc về con người" />
      {frame >= 26 && bannerOut < 1 ? (
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 70, opacity: 1 - bannerOut }}>
          <SlamText at={26} size={64} weight={900} ghost={18} from={1.7}>
            <span style={{ background: "rgba(6,11,22,0.9)", padding: "14px 34px", borderRadius: 20, border: `2px solid ${C.orange}` }}>
              AI chỉ <span style={{ color: C.ai }}>đề xuất</span> — con người <span style={{ color: C.green }}>duyệt</span>
            </span>
          </SlamText>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

export const Minutes: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <Sequence durationInFrames={60}>
      <MinutesPart />
    </Sequence>
    <Sequence from={60} durationInFrames={40}>
      <JsonPart />
    </Sequence>
    <Sequence from={100} durationInFrames={200}>
      <ReviewPart />
    </Sequence>
    <div style={{ position: "absolute", left: 0, top: 0, fontFamily: FONT }} />
  </AbsoluteFill>
);
