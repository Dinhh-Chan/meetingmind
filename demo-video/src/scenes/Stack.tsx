import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { Chip, Kicker, SlamText, TypeText } from "../components/text";
import { Icon } from "../components/ui";
import { C, FONT, MONO } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// 12 dịch vụ trong docker-compose.yml (theo báo cáo đề tài)
const SERVICES: { name: string; color: string }[] = [
  { name: "PostgreSQL 15", color: C.sky },
  { name: "Redis 7", color: C.red },
  { name: "RabbitMQ", color: C.orange },
  { name: "MinIO", color: C.red },
  { name: "api-gateway", color: C.primary },
  { name: "core-service", color: C.primary },
  { name: "integration-service", color: C.primary },
  { name: "ai-service", color: C.amber },
  { name: "ai-worker", color: C.amber },
  { name: "bot-worker", color: C.green },
  { name: "Prometheus", color: C.orange },
  { name: "Grafana", color: C.orange },
];

const CountPart: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.round(interpolate(frame, [10, 34], [0, 12], { ...clamp, easing: Easing.out(Easing.quad) }));
  const land = interpolate(frame, [34, 37, 41], [1, 1.12, 1], clamp);
  return (
    <AbsoluteFill>
      <Background tint={C.blue} />
      <Kicker at={0} num="06" label="TRIỂN KHAI" y={60} />
      <div style={{ position: "absolute", left: 120, top: 250, width: 640 }}>
        <div style={{ transform: `scale(${land})`, transformOrigin: "0 50%" }}>
          <SlamText at={10} size={330} weight={900} ghost={26} from={1.4} align="left" tracking={-0.06}>
            {String(n)}
          </SlamText>
        </div>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 76, color: C.white, marginTop: -10 }}>dịch vụ</div>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 40, color: C.muted, marginTop: 8 }}>đóng gói bằng Docker Compose</div>
        <div style={{ marginTop: 40, fontFamily: MONO, fontSize: 32, color: C.green, background: "rgba(5,10,22,0.85)", border: `1.5px solid ${C.green}55`, padding: "16px 24px", borderRadius: 14, display: "inline-block" }}>
          <span style={{ color: C.dim }}>$ </span>
          <TypeText at={56} text="docker compose up -d" cps={2} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 800, top: 250, width: 1020, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {SERVICES.map((s, i) => {
          const t = frame - (38 + i * 4);
          const sp = t >= 0 ? spring({ frame: t, fps, config: { damping: 10, stiffness: 240, mass: 0.6 } }) : 0;
          return (
            <div
              key={s.name}
              style={{
                transform: `scale(${sp})`,
                opacity: sp > 0 ? 1 : 0,
                background: "rgba(16,30,56,0.85)",
                border: `1.5px solid ${s.color}77`,
                borderRadius: 18,
                padding: "28px 18px",
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: 22,
                whiteSpace: "nowrap",
                color: C.white,
                display: "flex",
                alignItems: "center",
                gap: 14,
                boxShadow: `0 12px 30px -12px rgba(0,0,0,0.7)`,
              }}
            >
              <span style={{ width: 14, height: 14, borderRadius: 7, background: s.color, boxShadow: `0 0 12px ${s.color}`, flexShrink: 0 }} />
              {s.name}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// toạ độ trên ảnh kiến trúc 2560x1600 (tránh phần đang "thiết kế")
const PANS: { from: number; to: number; fx: number; fy: number; k: number; dx: number; label: string }[] = [
  { from: 0, to: 28, fx: 1040, fy: 700, k: 1.25, dx: 90, label: "core-service · NestJS" },
  { from: 28, to: 50, fx: 1480, fy: 925, k: 1.3, dx: -110, label: "RabbitMQ · outbox → publish" },
  { from: 50, to: 70, fx: 1880, fy: 1190, k: 1.35, dx: 120, label: "ai-worker · Whisper + LLM" },
  { from: 70, to: 90, fx: 2250, fy: 470, k: 1.45, dx: -90, label: "bot-worker · Playwright" },
];

const DiagramPart: React.FC = () => {
  const frame = useCurrentFrame();
  const pan = PANS.find((p) => frame >= p.from && frame < p.to) ?? PANS[PANS.length - 1];
  const t = frame - pan.from;
  const len = pan.to - pan.from;
  const prog = t / len;
  const k = pan.k * (1 + 0.12 * prog) * (pan === PANS[3] ? 1 + 0.6 * Math.pow(prog, 3) : 1);
  const x = 960 - (pan.fx + pan.dx * prog) * k;
  const y = 540 - pan.fy * k;
  const mb = interpolate(t, [0, 3], [16, 0], clamp);
  const skew = interpolate(t, [0, 3], [pan.dx > 0 ? -8 : 8, 0], clamp);
  return (
    <AbsoluteFill style={{ background: "#03060d", overflow: "hidden" }}>
      <Img
        src={staticFile("img/fig-architecture.png")}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: 2560 * k,
          height: 1600 * k,
          filter: `invert(1) hue-rotate(180deg) brightness(1.05) contrast(1.05)${mb > 0.5 ? ` blur(${mb}px)` : ""}`,
          transform: `skewX(${skew}deg)`,
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(3,6,13,0.85) 100%)" }} />
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${C.sky}11 1px, transparent 1px), linear-gradient(90deg, ${C.sky}11 1px, transparent 1px)`, backgroundSize: "60px 60px" }} />
      <Kicker at={0} num="07" label="BÊN DƯỚI LỚP VỎ" y={60} color={C.sky} />
      <Chip key={pan.label} at={pan.from + 2} style={{ left: 96, bottom: 80, fontFamily: MONO }} size={34} bg="rgba(5,10,22,0.92)">
        <Icon name="layers" size={36} color={C.orange} /> {pan.label}
      </Chip>
      <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame, [82, 90], [0, 0.85], clamp) }} />
    </AbsoluteFill>
  );
};

export const Stack: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={90}>
      <CountPart />
    </Sequence>
    <Sequence from={90} durationInFrames={90}>
      <DiagramPart />
    </Sequence>
  </AbsoluteFill>
);
