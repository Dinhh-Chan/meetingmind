// Font Việt hoá đầy đủ, đóng gói từ npm (@fontsource) -> không cần mạng khi render.
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/800.css";
import "@fontsource/be-vietnam-pro/900.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import { continueRender, delayRender } from "remotion";

const SAMPLE = "Họp xong ai ghi biên bản? Việc đã giao ai còn nhớ ặ ữ ỡ đ Đ 0123";

if (typeof document !== "undefined") {
  const handle = delayRender("Tải font Be Vietnam Pro");
  const loads = [
    ...[400, 500, 600, 700, 800, 900].map((w) => document.fonts.load(`${w} 40px "Be Vietnam Pro"`, SAMPLE)),
    ...[500, 700].map((w) => document.fonts.load(`${w} 40px "JetBrains Mono"`, SAMPLE)),
  ];
  Promise.all(loads)
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
}
