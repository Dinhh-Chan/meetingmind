export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const BPM = 120;
/** 1 phách = 15 khung, 1 ô nhịp = 60 khung ở 120 BPM / 30 fps. */
export const BEAT = (60 / BPM) * FPS;
export const BAR = BEAT * 4;

export const C = {
  ink: "#060B16",
  night: "#0A1428",
  navy: "#1F3A5F",
  blue: "#2E6DA4",
  primary: "#4C7CEB",
  sky: "#8FB3FF",
  orange: "#D9822B",
  amber: "#F2A65A",
  red: "#FF4D5E",
  green: "#2FCB8A",
  white: "#F4F7FF",
  muted: "#9DB0D0",
  dim: "#5D7194",
  ai: "#9B7CFF",
  trello: "#0C66E4",
  telegram: "#2AABEE",
} as const;

export const FONT = '"Be Vietnam Pro", system-ui, sans-serif';
export const MONO = '"JetBrains Mono", ui-monospace, monospace';

export const sec = (s: number) => Math.round(s * FPS);
