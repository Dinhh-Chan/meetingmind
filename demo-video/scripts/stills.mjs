// Kết xuất nhanh nhiều ảnh tĩnh để soát bố cục: node scripts/stills.mjs 12 64 420 ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const frames = process.argv.slice(2).map(Number);
const outDir = path.join(root, "out", "stills");
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
const opts = { serveUrl, browserExecutable: "/usr/bin/google-chrome", chromiumOptions: { gl: "angle-egl" } };
const composition = await selectComposition({ ...opts, id: "MeetingMindDemo" });
for (const f of frames) {
  const output = path.join(outDir, `f${String(f).padStart(4, "0")}.png`);
  await renderStill({ ...opts, composition, frame: f, output, scale: 0.5 });
  console.log("still", f);
}
