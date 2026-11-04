import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Kicker, SlamText } from "../components/text";
import { Glass, viNum } from "../components/ui";
import { C, FONT } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Stat = {
  at: number;
  render: (p: number) => React.ReactNode; // p = tiến độ đếm 0..1
  label: string;
  sub: string;
  color: string;
};

// Tất cả số liệu lấy từ báo cáo thực nghiệm của đề tài (đo trên bộ dữ liệu thử).
const STATS: Stat[] = [
  {
    at: 20,
    render: (p) => `${Math.round(4 * p)}/4`,
    label: "người nói được tách đúng",
    sub: "99,5% thời lượng gán đúng người · âm sạch",
    color: C.sky,
  },
  {
    at: 65,
    render: (p) => `${Math.round(15 * p)}/15`,
    label: "điểm trích xuất việc (LLM)",
    sub: "DeepSeek-V4.1-Flash · 3/3 lần chạy",
    color: C.ai,
  },
  {
    at: 110,
    render: (p) => `${viNum(14.7 * p, 1)}%`,
    label: "WER — tỷ lệ lỗi từ",
    sub: "Whisper medium · âm thanh sạch",
    color: C.orange,
  },
  {
    at: 155,
    render: (p) => `~${viNum(0.005 * p, 3)}`,
    label: "USD chi phí LLM / cuộc họp",
    sub: "gọi qua FPT AI Factory",
    color: C.green,
  },
];

const POS: [number, number][] = [
  [130, 300],
  [990, 300],
  [130, 650],
  [990, 650],
];

export const Numbers: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = interpolate(frame, [0, 300], [1, 1.04]);
  const exit = interpolate(frame, [282, 300], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill>
      <Background tint={C.blue} />
      <Kicker at={2} num="05" label="ĐO KIỂM THỰC TẾ" y={60} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, textAlign: "center" }}>
        <SlamText at={6} size={70} weight={800} ghost={14} from={1.5} out={282}>
          Số liệu đo thực tế, <span style={{ color: C.orange }}>không phải lời hứa</span>
        </SlamText>
      </div>
      <AbsoluteFill style={{ transform: `scale(${drift * (1 - exit * 0.2)})`, opacity: 1 - exit, filter: exit > 0.05 ? `blur(${exit * 14}px)` : undefined }}>
        {STATS.map((s, i) => {
          const t = frame - s.at;
          if (t < 0) return null;
          const sp = spring({ frame: t, fps, config: { damping: 12, stiffness: 190, mass: 0.7 } });
          const p = interpolate(t, [2, 24], [0, 1], { ...clamp, easing: Easing.out(Easing.quad) });
          const land = interpolate(t, [24, 27, 31], [1, 1.1, 1], clamp);
          const [x, y] = POS[i];
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, transform: `translateY(${(1 - sp) * 120}px) scale(${0.8 + 0.2 * sp})`, opacity: Math.min(1, sp * 1.4) }}>
              <Glass style={{ width: 800, height: 300, padding: "34px 48px", boxSizing: "border-box", position: "relative", overflow: "hidden" }} border={`${s.color}66`}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 10, background: s.color }} />
                <div
                  style={{
                    fontFamily: FONT,
                    fontWeight: 900,
                    fontSize: 128,
                    lineHeight: 1,
                    color: s.color,
                    letterSpacing: "-0.04em",
                    transform: `scale(${land})`,
                    transformOrigin: "0 50%",
                    textShadow: `0 0 40px ${s.color}55`,
                  }}
                >
                  {s.render(p)}
                </div>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 40, color: C.white, marginTop: 18 }}>{s.label}</div>
                <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 27, color: C.muted, marginTop: 8 }}>{s.sub}</div>
              </Glass>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
