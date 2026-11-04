import React from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { Background } from "../components/Background";
import { Scanlines } from "../components/fx";
import { SlamText, TypeText } from "../components/text";
import { Icon, ICONS } from "../components/ui";
import { C, FONT } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const ITEMS: { at: number; text: string; icon: keyof typeof ICONS; cx: number; cy: number }[] = [
  { at: 0, text: "Ghi chép tay", icon: "pen", cx: 520, cy: 400 },
  { at: 30, text: "Sót việc", icon: "missing", cx: 1400, cy: 400 },
  { at: 67, text: "Giao nhầm người", icon: "swap", cx: 520, cy: 680 },
  { at: 97, text: "Trễ hạn", icon: "clock", cx: 1400, cy: 680 },
];

const IMPLODE = 120; // khung cục bộ bắt đầu hút vào tâm
const TYPE_AT = 156;

/** Cảnh 2 + build: 4 nỗi đau đập lần lượt -> hút vào tâm -> "Có cách khác." -> vòng sóng dồn tới drop. */
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const imp = interpolate(frame, [IMPLODE, IMPLODE + 30], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  return (
    <AbsoluteFill>
      <Background intensity={0.7} tint={C.red} />
      {frame < IMPLODE + 32
        ? ITEMS.map((it, i) => {
            const t = frame - it.at;
            if (t < 0) return null;
            const fly = interpolate(t, [9, 19], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
            const startScale = 1.65;
            const scale = (startScale + (1 - startScale) * fly) * (1 - imp);
            const x = 960 + (it.cx - 960) * fly * (1 - imp);
            const y = 540 + (it.cy - 540) * fly * (1 - imp);
            const rot = imp * (i % 2 ? 160 : -160);
            const jitter = t < 9 && random(`pj${i}-${frame}`) > 0.6 ? (random(`px${i}-${frame}`) - 0.5) * 14 : 0;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x + jitter,
                  top: y,
                  transform: `translate(-50%,-50%) scale(${scale}) rotate(${rot}deg)`,
                  filter: imp > 0.05 ? `blur(${imp * 10}px)` : undefined,
                  opacity: 1 - imp * 0.6,
                }}
              >
                <SlamText at={it.at} size={1} ghost={0} from={1.25}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 28,
                      padding: "30px 46px",
                      borderRadius: 28,
                      background: "rgba(40,10,20,0.55)",
                      border: `2px solid ${C.red}88`,
                      boxShadow: `0 0 60px ${C.red}33`,
                      width: 760,
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ width: 96, height: 96, borderRadius: 24, background: `${C.red}22`, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <Icon name={it.icon} size={60} color={C.red} stroke={2.2} />
                    </div>
                    <span style={{ fontFamily: FONT, fontWeight: 900, fontSize: 76, color: C.white, letterSpacing: "-0.03em" }}>{it.text}</span>
                  </div>
                </SlamText>
              </div>
            );
          })
        : null}
      {/* điểm sáng sau khi hút */}
      {frame >= IMPLODE + 26 ? <Core frame={frame} /> : null}
      {frame >= TYPE_AT ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: 110,
              color: C.white,
              letterSpacing: "-0.03em",
              transform: `translateY(${-230}px) scale(${interpolate(frame, [TYPE_AT, 236], [1, 1.12], clamp)})`,
              opacity: interpolate(frame, [214, 226], [1, 0], clamp),
            }}
          >
            <TypeText at={TYPE_AT} text="Có cách khác." cps={2} />
          </div>
        </AbsoluteFill>
      ) : null}
      {frame >= 228 ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ transform: "translateY(-250px)" }}>
            <SlamText at={228} size={64} weight={700} color={C.sky} ghost={14} from={1.4} tracking={0.3}>
              GIỚI THIỆU
            </SlamText>
          </div>
        </AbsoluteFill>
      ) : null}
      <Scanlines opacity={0.05} />
      {/* hút sáng trắng ngay trước drop */}
      <AbsoluteFill style={{ background: "radial-gradient(circle, #ffffff 0%, rgba(143,179,255,0.6) 30%, transparent 60%)", opacity: interpolate(frame, [232, 240], [0, 1], clamp) }} />
    </AbsoluteFill>
  );
};

/** Lõi phát sáng + vòng sóng dồn dập dần (theo trống dồn của nhạc). */
const Core: React.FC<{ frame: number }> = ({ frame }) => {
  const t = frame - (IMPLODE + 26);
  const p = interpolate(frame, [IMPLODE + 26, 240], [0, 1], clamp);
  const coreSize = 16 + 120 * p * p;
  const speed = 6 + 30 * p * p; // px mỗi khung
  const rings = 7;
  return (
    <AbsoluteFill>
      {new Array(rings).fill(0).map((_, k) => {
        const r = ((t * speed + k * 140) % 980) + 10;
        const o = (1 - r / 990) * (0.25 + 0.6 * p);
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: 960 - r,
              top: 540 - r,
              width: 2 * r,
              height: 2 * r,
              borderRadius: "50%",
              border: `${2 + 3 * p}px solid ${k % 2 ? C.sky : C.primary}`,
              opacity: o,
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 960 - coreSize / 2,
          top: 540 - coreSize / 2,
          width: coreSize,
          height: coreSize,
          borderRadius: "50%",
          background: "radial-gradient(circle, #fff 0%, #8FB3FF 45%, rgba(76,124,235,0) 72%)",
          boxShadow: `0 0 ${60 + 160 * p}px ${C.primary}`,
        }}
      />
    </AbsoluteFill>
  );
};
