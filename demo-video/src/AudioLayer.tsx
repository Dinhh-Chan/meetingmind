import React from "react";
import { getInputProps, Html5Audio, interpolate, Sequence, staticFile } from "remotion";
import { SFX, SFX_LEN, TOTAL, VO, voFrames } from "./timeline";

/** Hệ số tổng (chỉnh để đạt ~-14 LUFS sau khi đo bằng ffmpeg ebur128). */
// Mix thô để chừa headroom (~-3 dB); scripts/master.py nâng về -14 LUFS + limiter.
export const MASTER = { music: 0.63, vo: 1.19, sfx: 0.52 }; // VO là FLAC mono: Remotion trộn mono xuống stereo -3 dB nên bù +3 dB

/** Ducking nhạc khi có lời thoại: giảm còn ~22% (≈ -13 dB), vào 4 khung, nhả 10 khung. */
const duck = (f: number) => {
  let g = 1;
  for (const v of VO) {
    const a = v.from;
    const b = v.from + voFrames(v.id);
    const k = interpolate(f, [a - 4, a, b, b + 10], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    g = Math.min(g, 1 - 0.78 * k);
  }
  return g;
};

/** SFX bắt đầu trong (hoặc ngay trước) một câu thoại thì giảm ~5 dB để lời luôn rõ. */
const sfxDuck = (f: number, len: number) => {
  for (const v of VO) {
    const a = v.from - 12;
    const b = v.from + voFrames(v.id);
    if (f < b && f + Math.min(len, 20) > a) return 0.55;
  }
  return 1;
};

/** Kết xuất riêng từng nhóm để kiểm tra mix: --props='{"stem":"vo"}' | "bg" (nhạc + SFX). */
const STEM = (getInputProps() as { stem?: string }).stem ?? "all";

export const AudioLayer: React.FC = () => {
  const showVo = STEM === "all" || STEM === "vo";
  const showBg = STEM === "all" || STEM === "bg";
  return (
    <>
      {showBg ? <Html5Audio
        src={staticFile("music/bed.flac")}
        volume={(f) => MASTER.music * duck(f) * interpolate(f, [0, 4, TOTAL - 30, TOTAL], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      /> : null}
      {showVo && VO.map((v) => (
        <Sequence key={v.id} from={v.from} durationInFrames={voFrames(v.id) + 3} layout="none">
          <Html5Audio src={staticFile(`vo/${v.id}.flac`)} volume={MASTER.vo} />
        </Sequence>
      ))}
      {showBg && SFX.map((c, i) => (
        <Sequence key={`${c.s}-${c.f}-${i}`} from={c.f} durationInFrames={Math.ceil((SFX_LEN[c.s] ?? 1) * 30) + 2} layout="none">
          <Html5Audio src={staticFile(`sfx/${c.s}.wav`)} volume={c.v * MASTER.sfx * sfxDuck(c.f, (SFX_LEN[c.s] ?? 1) * 30)} />
        </Sequence>
      ))}
    </>
  );
};
