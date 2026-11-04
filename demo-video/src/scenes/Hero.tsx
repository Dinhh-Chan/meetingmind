import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame } from "remotion";
import { AppWindow, camAt, Cam, HighlightBox, toScreen } from "../components/AppWindow";
import { Background } from "../components/Background";
import { TelegramBubble, TrelloColumn } from "../components/mocks";
import { Kicker, SlamText } from "../components/text";
import { Callout, viNum } from "../components/ui";
import { C, FONT, MONO } from "../theme";
import { Burst } from "./LogoScene";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// --- A: bấm "✓ Duyệt" thật (hero_review.mp4, click ở 6,116 s -> khung cục bộ 60)
const CLICK_CAMS: Cam[] = [
  { f: 0, s: 1.55, x: 0.3, y: 0.53 },
  { f: 52, s: 2.4, x: 0.22, y: 0.58 },
  { f: 60, s: 2.45, x: 0.22, y: 0.58 },
  { f: 68, s: 1.22, x: 0.56, y: 0.62 },
  { f: 90, s: 1.18, x: 0.58, y: 0.64 },
];

const ClickPart: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = camAt(CLICK_CAMS, frame);
  const tension = interpolate(frame, [0, 58, 61], [0.0, 0.55, 0], clamp);
  const toast = toScreen(cam, 0.755, 0.94);
  return (
    <AbsoluteFill>
      <AppWindow src="clips/hero_review.mp4" trimBefore={4.1} rate={1} cams={CLICK_CAMS} enterAt={-30} url="localhost:3001/work/review">
        <HighlightBox at={72} u0={0.752} v0={0.91} u1={0.985} v1={0.972} color={C.green} camScale={cam.s} />
      </AppWindow>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 55%, transparent 25%, rgba(0,0,0,${tension}) 75%)` }} />
      {frame < 60 ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 28, color: C.white, opacity: interpolate(frame, [6, 14], [0, 1], clamp) }}>
          <span style={{ background: "rgba(6,11,22,0.88)", padding: "12px 24px", borderRadius: 12 }}>
            <span style={{ color: C.red }}>●</span> QUAY MÀN HÌNH THẬT · duyệt 1 đề xuất AI
          </span>
        </div>
      ) : null}
      <Burst frame={frame} at={60} n={22} color={C.green} />
      {frame >= 64 ? (
        <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 90 }}>
          <SlamText at={66} size={110} weight={900} ghost={26} from={2.2}>
            <span style={{ background: "rgba(6,11,22,0.88)", padding: "8px 34px", borderRadius: 24 }}>
              1 cú nhấp <span style={{ color: C.green }}>duyệt.</span>
            </span>
          </SlamText>
        </AbsoluteFill>
      ) : null}
      <Callout at={74} x={toast.x} y={toast.y} dx={-200} dy={-170} color={C.green} text="Task chính thức vào cột Todo" />
      {frame < 62 ? <Kicker at={2} num="04" label="DUYỆT → ĐỒNG BỘ" y={60} /> : null}
    </AbsoluteFill>
  );
};

// --- B: thẻ Trello + tin Telegram
const SyncPart: React.FC = () => {
  const frame = useCurrentFrame();
  const line = interpolate(frame, [8, 30], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill>
      <Background tint={C.trello} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center" }}>
        <SlamText at={2} size={66} weight={800} ghost={14} from={1.6}>
          Tự đồng bộ ra <span style={{ color: "#579dff" }}>Trello</span> &amp; <span style={{ color: C.telegram }}>Telegram</span>
        </SlamText>
      </div>
      {/* đường nối từ nút duyệt */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <path d="M960 190 C 960 240, 560 230, 560 262" stroke={C.green} strokeWidth={4} fill="none" strokeDasharray="600" strokeDashoffset={600 * (1 - line)} />
        <path d="M960 190 C 960 240, 1360 230, 1360 262" stroke={C.green} strokeWidth={4} fill="none" strokeDasharray="600" strokeDashoffset={600 * (1 - line)} />
      </svg>
      <div style={{ position: "absolute", left: 240, top: 270 }}>
        <TrelloColumn at={20} />
      </div>
      <div style={{ position: "absolute", left: 1040, top: 270 }}>
        <TelegramBubble at={52} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, textAlign: "center", fontFamily: FONT, fontSize: 20, color: C.dim }}>
        Minh hoạ theo đúng nội dung thẻ/tin mà integration-service gửi cho task vừa duyệt
      </div>
    </AbsoluteFill>
  );
};

// --- C: 3,4 giây
const TimePart: React.FC = () => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [0, 26], [0, 3.4], { ...clamp, easing: Easing.out(Easing.quad) });
  const land = interpolate(frame, [26, 30, 34], [1, 1.12, 1], clamp);
  return (
    <AbsoluteFill>
      <Background tint={C.green} />
      <Burst frame={frame} at={26} color={C.green} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 64, transform: `scale(${land})` }}>
          <SlamText at={0} size={330} weight={900} ghost={30} from={1.5} tracking={-0.05}>
            {viNum(v, 1)}
          </SlamText>
          <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 130, color: C.green }}>giây</span>
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 40, color: C.muted, marginTop: 10, opacity: interpolate(frame, [20, 28], [0, 1], clamp) }}>
          từ lúc bấm Duyệt → thẻ Trello được tạo, kèm tin Telegram · <span style={{ color: C.white }}>đo thực tế</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// --- D: drawer task thật hiển thị trạng thái đồng bộ (hero_drawer.mp4)
const DRAWER_CAMS: Cam[] = [
  { f: 0, s: 1.0, x: 0.5, y: 0.5 },
  { f: 24, s: 1.0, x: 0.52, y: 0.5 },
  { f: 44, s: 1.95, x: 0.86, y: 0.37 },
  { f: 120, s: 2.05, x: 0.86, y: 0.38 },
];

const DrawerPart: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = camAt(DRAWER_CAMS, frame);
  const p = toScreen(cam, 0.76, 0.45);
  return (
    <AbsoluteFill>
      <AppWindow src="clips/hero_drawer.mp4" trimBefore={1.5} rate={1.5} cams={DRAWER_CAMS} enterAt={-30} url="localhost:3001/work/board">
        <HighlightBox at={48} u0={0.758} v0={0.414} u1={0.95} v1={0.49} color={C.green} camScale={cam.s} />
      </AppWindow>
      <Callout at={52} x={p.x - 8} y={p.y} dx={-330} dy={170} color={C.green} text="Đồng bộ: Trello ↗ · Đã báo Telegram" sub="trạng thái thật trên task vừa duyệt" />
    </AbsoluteFill>
  );
};

export const Hero: React.FC = () => (
  <AbsoluteFill>
    <Background />
    <Sequence durationInFrames={90}>
      <ClickPart />
    </Sequence>
    <Sequence from={90} durationInFrames={100}>
      <SyncPart />
    </Sequence>
    <Sequence from={190} durationInFrames={50}>
      <TimePart />
    </Sequence>
    <Sequence from={240} durationInFrames={120}>
      <DrawerPart />
    </Sequence>
  </AbsoluteFill>
);
