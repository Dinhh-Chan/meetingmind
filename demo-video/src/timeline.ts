/**
 * Mốc thời gian toàn video (khung hình, 30 fps, 120 BPM: 1 phách = 15 khung).
 * Hình, lời thoại và hiệu ứng âm thanh đều đọc từ đây để luôn khớp nhau.
 */
import voDur from "./vo-durations.json";

export const TOTAL = 2550; // 85 s

export const SCENES = {
  hook: [0, 180],
  problem: [180, 360],
  build: [360, 420],
  logo: [420, 540],
  capture: [540, 780],
  transcript: [780, 1080],
  minutes: [1080, 1380],
  hero: [1380, 1740],
  numbers: [1740, 2040],
  stack: [2040, 2220],
  outro: [2220, 2550],
} as const;

export type SceneName = keyof typeof SCENES;

// ------------------------------------------------------------------ lời thoại
export const VO: { id: keyof typeof voDur; from: number }[] = [
  { id: "vo01a_hook", from: 12 },
  { id: "vo01b_hook", from: 99 },
  { id: "vo02a_problem", from: 178 },
  { id: "vo02b_problem", from: 208 },
  { id: "vo02c_problem", from: 245 },
  { id: "vo02d_problem", from: 275 },
  { id: "vo03_logo", from: 410 },
  { id: "vo04_capture", from: 549 },
  { id: "vo05_transcript", from: 795 },
  { id: "vo06_minutes", from: 1086 },
  { id: "vo07_hero", from: 1450 },
  { id: "vo08_numbers", from: 1748 },
  { id: "vo09_stack", from: 2050 },
  { id: "vo10_outro", from: 2228 },
];

export const voFrames = (id: keyof typeof voDur) => Math.ceil(voDur[id] * 30);

// ------------------------------------------------------------------ nhịp đập hình (rung, loé, phóng)
export type Hit = { f: number; shake: number; flash?: number; zoom?: number };
export const HITS: Hit[] = [
  { f: 12, shake: 16, zoom: 0.03 },
  { f: 64, shake: 14, zoom: 0.03 },
  { f: 99, shake: 16, zoom: 0.03 },
  { f: 147, shake: 26, flash: 0.35, zoom: 0.05 },
  { f: 180, shake: 12 },
  { f: 210, shake: 12 },
  { f: 247, shake: 12 },
  { f: 277, shake: 14 },
  { f: 330, shake: 8 },
  { f: 420, shake: 30, flash: 1, zoom: 0.06 },
  { f: 460, shake: 6 },
  { f: 540, shake: 8 },
  { f: 834, shake: 5 },
  { f: 1206, shake: 14, flash: 0.25, zoom: 0.03 },
  { f: 1440, shake: 26, flash: 0.9, zoom: 0.06 },
  { f: 1490, shake: 10 },
  { f: 1522, shake: 6 },
  { f: 1596, shake: 22, flash: 0.5, zoom: 0.05 },
  { f: 1784, shake: 6 },
  { f: 1829, shake: 6 },
  { f: 1874, shake: 6 },
  { f: 1919, shake: 6 },
  { f: 2074, shake: 12, flash: 0.2 },
  { f: 2220, shake: 30, flash: 1, zoom: 0.06 },
  { f: 2282, shake: 6 },
  { f: 2460, shake: 20, flash: 0.7, zoom: 0.04 },
];

// ------------------------------------------------------------------ cửa sổ glitch toàn khung (RGB tách + dịch dải ngang)
export type Glitch = { f: number; dur: number; amt: number };
export const GLITCHES: Glitch[] = [
  { f: 0, dur: 10, amt: 1 },
  { f: 12, dur: 5, amt: 0.6 },
  { f: 64, dur: 6, amt: 0.7 },
  { f: 94, dur: 7, amt: 1 },
  { f: 147, dur: 6, amt: 0.8 },
  { f: 168, dur: 12, amt: 1 },
  { f: 296, dur: 6, amt: 0.5 },
  { f: 328, dur: 6, amt: 0.8 },
  { f: 408, dur: 4, amt: 0.6 },
  { f: 420, dur: 9, amt: 1 },
  { f: 438, dur: 4, amt: 0.8 },
  { f: 528, dur: 12, amt: 0.9 },
  { f: 676, dur: 6, amt: 0.8 },
  { f: 736, dur: 4, amt: 0.6 },
  { f: 775, dur: 6, amt: 0.8 },
  { f: 1074, dur: 7, amt: 0.9 },
  { f: 1138, dur: 5, amt: 0.8 },
  { f: 1174, dur: 5, amt: 0.7 },
  { f: 1206, dur: 4, amt: 0.6 },
  { f: 1374, dur: 6, amt: 0.8 },
  { f: 1440, dur: 6, amt: 0.9 },
  { f: 1466, dur: 6, amt: 0.9 },
  { f: 1564, dur: 6, amt: 0.8 },
  { f: 1614, dur: 6, amt: 0.8 },
  { f: 1734, dur: 7, amt: 0.9 },
  { f: 2020, dur: 20, amt: 0.7 },
  { f: 2128, dur: 6, amt: 0.9 },
  { f: 2158, dur: 3, amt: 0.6 },
  { f: 2180, dur: 3, amt: 0.6 },
  { f: 2200, dur: 3, amt: 0.7 },
  { f: 2210, dur: 10, amt: 1 },
  { f: 2220, dur: 8, amt: 1 },
  { f: 2234, dur: 4, amt: 0.8 },
  { f: 2460, dur: 10, amt: 1 },
];

// ------------------------------------------------------------------ hiệu ứng âm thanh
export type Cue = { f: number; s: string; v: number };
const cues: Cue[] = [];
const cue = (f: number, s: string, v: number) => cues.push({ f, s, v });
const ticks = (from: number, to: number, every: number, v: number, s = "tick") => {
  for (let f = from; f < to; f += every) cue(f, s, v);
};
const keys = (from: number, n: number, every: number, v: number) => {
  for (let i = 0; i < n; i++) cue(from + i * every, `key${(i * 7) % 4}`, v);
};

// 1. Hook
cue(0, "glitch3", 0.55);
cue(12, "hit", 0.9);
cue(12, "glitch1", 0.45);
cue(64, "stutter_hit", 0.85);
cue(94, "glitch2", 0.55);
cue(95, "whoosh_fast", 0.5);
cue(99, "hit", 0.9);
cue(147, "impact", 0.95);
cue(147, "glitch1", 0.4);
cue(168, "glitch3", 0.5);
cue(172, "whoosh", 0.7);
// 2. Problem
[180, 210, 247, 277].forEach((f, i) => {
  cue(f, i % 2 ? "stutter_hit" : "hit", 0.8);
  cue(f + 8, "whoosh_fast", 0.3);
});
cue(294, "swoosh_rev", 0.65);
cue(300, "riser4", 0.7);
cue(330, "pop", 0.6);
cue(330, "glitch2", 0.45);
keys(336, 13, 2, 0.45);
// 3. Build + logo
cue(360, "whoosh_low", 0.55);
cue(408, "glitch1", 0.35);
cue(420, "bassdrop", 1.0);
cue(420, "impact", 0.9);
cue(420, "glitch2", 0.45);
cue(436, "whoosh_fast", 0.5);
cue(438, "glitch1", 0.35);
ticks(442, 462, 2, 0.22);
cue(460, "hit", 0.55);
cue(476, "whoosh", 0.45);
cue(526, "whoosh", 0.75);
cue(528, "glitch1", 0.4);
// 4. Capture
cue(540, "hit", 0.6);
[549, 592, 638].forEach((f) => {
  cue(f, "whoosh_fast", 0.55);
  cue(f + 4, "pop", 0.55);
});
cue(674, "whoosh", 0.7);
cue(676, "glitch2", 0.4);
cue(682, "click", 0.6);
keys(706, 10, 2, 0.35);
cue(736, "whoosh_fast", 0.6);
[742, 748, 754, 758].forEach((f) => cue(f, "pop", 0.4));
cue(774, "whoosh", 0.65);
// 5. Transcript
cue(780, "whoosh_low", 0.5);
cue(796, "click", 0.6);
cue(804, "whoosh_fast", 0.35);
cue(834, "hit", 0.45);
cue(838, "tick", 0.35);
cue(850, "pop", 0.45);
cue(864, "tick", 0.35);
cue(874, "pop", 0.45);
cue(892, "whoosh_fast", 0.45);
cue(920, "whoosh", 0.5);
cue(964, "pop", 0.45);
cue(1001, "whoosh_fast", 0.45);
cue(1072, "whoosh", 0.65);
cue(1074, "glitch1", 0.45);
// 6. Minutes + review
cue(1080, "whoosh_low", 0.5);
cue(1092, "click", 0.6);
cue(1100, "whoosh_fast", 0.35);
[1106, 1110, 1114].forEach((f) => cue(f, "tick", 0.35));
cue(1110, "pop", 0.45);
cue(1138, "glitch2", 0.45);
cue(1139, "whoosh_fast", 0.5);
keys(1142, 15, 2, 0.28);
cue(1170, "whoosh", 0.6);
cue(1184, "tick", 0.35);
cue(1192, "pop", 0.45);
cue(1206, "impact", 0.7);
cue(1290, "whoosh_fast", 0.4);
cue(1300, "tick", 0.35);
cue(1310, "pop", 0.45);
cue(1372, "whoosh", 0.6);
// 7. Hero
cue(1380, "whoosh_low", 0.35);
cue(1380, "riser2", 0.75);
cue(1440, "impact", 1.0);
cue(1440, "click", 0.85);
cue(1440, "shutter", 0.55);
cue(1440, "bassdrop", 0.55);
cue(1444, "glitch2", 0.3);
cue(1452, "tick", 0.35);
cue(1460, "pop", 0.45);
cue(1466, "whoosh", 0.7);
cue(1466, "glitch1", 0.4);
cue(1472, "hit", 0.45);
cue(1478, "whoosh_fast", 0.3);
cue(1486, "whoosh_fast", 0.45);
cue(1490, "hit", 0.75);
cue(1522, "notif", 0.85);
cue(1522, "pop", 0.35);
cue(1564, "glitch2", 0.45);
cue(1565, "whoosh_fast", 0.5);
ticks(1570, 1596, 2, 0.32);
cue(1596, "impact", 0.9);
cue(1614, "whoosh", 0.7);
cue(1631, "click", 0.6);
cue(1644, "whoosh_fast", 0.4);
cue(1668, "tick", 0.35);
cue(1678, "pop", 0.5);
cue(1732, "whoosh", 0.7);
cue(1734, "glitch1", 0.4);
// 8. Numbers
cue(1746, "hit", 0.65);
[1760, 1805, 1850, 1895].forEach((f) => {
  cue(f, "whoosh_fast", 0.45);
  cue(f + 2, "pop", 0.45);
  ticks(f + 2, f + 24, 2, 0.26);
  cue(f + 24, "hit", 0.55);
});
cue(2020, "glitch3", 0.5);
cue(2032, "whoosh", 0.7);
// 9. Stack
cue(2040, "hit", 0.55);
ticks(2050, 2074, 2, 0.3);
cue(2074, "impact", 0.7);
for (let i = 0; i < 12; i++) cue(2078 + i * 4, "pop", 0.3);
keys(2096, 20, 2, 0.28);
cue(2128, "whoosh", 0.7);
cue(2128, "glitch2", 0.4);
cue(2160, "riser2", 0.7);
[2156, 2178, 2198].forEach((f) => cue(f, "whoosh_fast", 0.55));
// 10. Outro
cue(2220, "bassdrop", 1.0);
cue(2220, "impact", 0.9);
cue(2220, "glitch2", 0.45);
cue(2232, "whoosh_fast", 0.5);
cue(2234, "glitch1", 0.35);
ticks(2236, 2256, 2, 0.22);
cue(2282, "hit", 0.55);
[2330, 2338, 2346, 2354].forEach((f) => cue(f, "pop", 0.32));
cue(2460, "impact", 0.95);
cue(2460, "glitch3", 0.55);
cue(2492, "whoosh_low", 0.3);

export const SFX = cues;

/** Độ dài file SFX (giây) để đặt durationInFrames hợp lý. */
export const SFX_LEN: Record<string, number> = {
  whoosh: 0.7, whoosh_fast: 0.35, whoosh_low: 0.9, swoosh_rev: 1.2, impact: 1.8, hit: 0.7,
  stutter_hit: 0.68, glitch1: 0.42, glitch2: 0.3, glitch3: 0.6, click: 0.06, pop: 0.18, tick: 0.04,
  riser4: 4.0, riser2: 2.0, bassdrop: 3.0, shutter: 0.32, notif: 0.9, bleep: 0.12,
  key0: 0.05, key1: 0.05, key2: 0.05, key3: 0.05,
};
