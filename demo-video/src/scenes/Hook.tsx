import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { Background } from "../components/Background";
import { Scanlines } from "../components/fx";
import { SlamText } from "../components/text";
import { C, MONO } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Dải sóng âm nằm ngang: phẳng -> giật theo các cú đập chữ. */
const Wave: React.FC<{ frame: number; energy: number; color?: string; y?: number }> = ({ frame, energy, color = C.sky, y = 540 }) => {
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const x = (i / 120) * 1920;
    const env = Math.sin((i / 120) * Math.PI);
    const a = energy * env * (40 + 90 * random(`w${i}-${Math.floor(frame / 2)}`));
    pts.push(`${x},${y + (i % 2 ? a : -a)}`);
  }
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={3} opacity={0.5} />
    </svg>
  );
};

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const hits = [12, 64, 99, 147];
  let energy = 0.04;
  hits.forEach((h) => {
    const d = frame - h;
    if (d >= 0 && d < 30) energy = Math.max(energy, Math.exp(-d / 6));
  });
  const recBlink = Math.floor(frame / 10) % 2 === 0;
  const part2 = frame >= 95;
  // nửa đầu
  const out1 = 94;
  return (
    <AbsoluteFill>
      <Background intensity={0.55} grid={false} tint={C.navy} />
      <Wave frame={frame} energy={energy} y={540} color={part2 ? C.orange : C.sky} />
      {/* thanh trạng thái kiểu "cuộc họp vừa kết thúc" */}
      <div style={{ position: "absolute", left: 80, top: 64, fontFamily: MONO, fontSize: 28, color: C.muted, display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ width: 18, height: 18, borderRadius: 9, background: C.red, opacity: recBlink ? 1 : 0.25, display: "inline-block" }} />
        <span>CUỘC HỌP ĐÃ KẾT THÚC · 47:12</span>
      </div>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 30 }}>
        {!part2 ? (
          <>
            <SlamText at={12} size={170} out={out1} outDur={5}>
              Họp xong…
            </SlamText>
            <SlamText at={64} size={124} weight={800} out={out1} outDur={5} color={C.white}>
              ai ghi <span style={{ color: C.orange }}>biên bản</span>?
            </SlamText>
          </>
        ) : (
          <>
            <SlamText at={99} size={150} out={170} outDur={8}>
              Việc đã giao…
            </SlamText>
            <SlamText at={147} size={190} weight={900} out={170} outDur={8} from={2.6} ghost={34}>
              ai <span style={{ color: C.red }}>còn nhớ</span>?
            </SlamText>
          </>
        )}
      </AbsoluteFill>
      <Scanlines opacity={0.06} />
      {/* tối dần ở cuối để cắt sang cảnh sau */}
      <AbsoluteFill style={{ background: "#000", opacity: interpolate(frame, [172, 180], [0, 0.6], clamp) }} />
    </AbsoluteFill>
  );
};
