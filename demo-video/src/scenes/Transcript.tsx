import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { AppWindow, camAt, Cam, HighlightBox, toScreen } from "../components/AppWindow";
import { Background } from "../components/Background";
import { Chip, Kicker } from "../components/text";
import { Callout, Icon } from "../components/ui";
import { C, MONO } from "../theme";

// clip transcript.mp4: bấm tab ở 1,94 s, rê nhãn người nói 4,84 s, cuộn 6,5 -> 13 s
const CAMS: Cam[] = [
  { f: 0, s: 0.95, x: 0.5, y: 0.5 },
  { f: 22, s: 1.0, x: 0.5, y: 0.5 },
  { f: 48, s: 1.6, x: 0.36, y: 0.62 },
  { f: 112, s: 1.62, x: 0.36, y: 0.64 },
  { f: 140, s: 1.2, x: 0.46, y: 0.5 },
  { f: 172, s: 1.75, x: 0.81, y: 0.31 },
  { f: 221, s: 1.8, x: 0.81, y: 0.22 },
  { f: 258, s: 1.05, x: 0.5, y: 0.5 },
  { f: 300, s: 1.0, x: 0.5, y: 0.52 },
];

export const Transcript: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = camAt(CAMS, frame);
  const a = toScreen(cam, 0.19, 0.55);
  const b = toScreen(cam, 0.243, 0.512);
  const c = toScreen(cam, 0.672, 0.3);
  return (
    <AbsoluteFill>
      <Background />
      <AppWindow src="clips/transcript.mp4" trimBefore={1.2} rate={1.4} cams={CAMS} url="localhost:3001/meetings/6aeb5e80…  ·  Transcript">
        <HighlightBox at={58} out={112} u0={0.19} v0={0.395} u1={0.247} v1={0.975} color={C.orange} camScale={cam.s} />
        <HighlightBox at={84} out={112} u0={0.192} v0={0.502} u1={0.245} v1={0.523} color={C.sky} camScale={cam.s} />
      </AppWindow>
      <Callout at={64} out={112} x={a.x} y={a.y} dx={-40} dy={260} text="Tách người nói tự động" sub="Người nói 1 → 5" />
      <Callout at={88} out={112} x={b.x} y={b.y} dx={330} dy={250} text="Mốc thời gian từng câu" color={C.sky} />
      <Callout at={178} out={226} x={c.x} y={c.y} dx={-330} dy={190} text="Gán tên cho từng giọng" sub="5 cụm giọng → người tham dự" color={C.green} />
      <Kicker at={2} num="02" label="PHIÊN ÂM + TÁCH NGƯỜI NÓI" y={60} />
      <Chip at={54} out={160} style={{ right: 90, top: 50, fontFamily: MONO }} size={30} bg="rgba(8,14,30,0.9)">
        <Icon name="mic" size={36} color={C.sky} /> Whisper · tiếng Việt
      </Chip>
    </AbsoluteFill>
  );
};
