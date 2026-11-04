import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../theme";

/** Nền tối: gradient navy + 2 đốm sáng trôi + lưới phối cảnh mờ. */
export const Background: React.FC<{ tint?: string; grid?: boolean; intensity?: number }> = ({ tint = C.primary, grid = true, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const a = frame / 90;
  const x1 = 30 + 12 * Math.sin(a);
  const y1 = 35 + 10 * Math.cos(a * 0.8);
  const x2 = 72 + 10 * Math.cos(a * 0.7);
  const y2 = 70 + 8 * Math.sin(a * 1.1);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${C.night} 0%, ${C.ink} 60%, #04070F 100%)` }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${x1}% ${y1}%, ${tint}55 0%, transparent 38%), radial-gradient(circle at ${x2}% ${y2}%, ${C.orange}33 0%, transparent 34%)`,
          opacity: intensity,
        }}
      />
      {grid ? (
        <AbsoluteFill style={{ perspective: 900, overflow: "hidden", opacity: 0.35 * intensity }}>
          <div
            style={{
              position: "absolute",
              left: "-50%",
              width: "200%",
              top: "48%",
              height: "120%",
              transform: "rotateX(72deg)",
              transformOrigin: "50% 0%",
              backgroundImage: `linear-gradient(${C.sky}33 1.5px, transparent 1.5px), linear-gradient(90deg, ${C.sky}33 1.5px, transparent 1.5px)`,
              backgroundSize: "80px 80px",
              backgroundPosition: `0px ${(frame * 2.2) % 80}px`,
              maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.9), transparent 70%)",
            }}
          />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
