import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, MONO } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Dữ liệu của đúng task được duyệt trong video (trùng với dữ liệu thật trên môi trường local):
 * nội dung tin/thẻ theo định dạng của integration-service (format.ts).
 */
export const HERO = {
  title: "Hỏi khách về kênh gửi thông báo nhắc lịch",
  // core-service gửi assigneeHint khi task chưa giao người -> tin/thẻ ghi "Administrator"
  assignee: "Administrator",
  deadline: "Chưa có",
  priority: "Trung bình",
  meeting: "Kiểm chứng bản sửa – họp sprint 12",
  quote: "Cái đó chị chưa hỏi khách, chị sẽ hỏi bên phòng khám rồi đó lại.",
};

/** Cột Trello "Việc từ cuộc họp" với thẻ mới trượt vào. */
export const TrelloColumn: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - at;
  const s = spring({ frame: t, fps, config: { damping: 12, stiffness: 180, mass: 0.8 } });
  const glow = interpolate(t, [0, 6, 30], [0, 1, 0.25], clamp);
  return (
    <div style={{ width: 640, fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: C.trello, display: "grid", placeItems: "center" }}>
          <svg width="26" height="26" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7.5" height="15" rx="1.6" fill="#fff" />
            <rect x="13.5" y="3" width="7.5" height="9" rx="1.6" fill="#fff" />
          </svg>
        </div>
        <div style={{ color: C.white, fontWeight: 800, fontSize: 34 }}>Trello</div>
        <div style={{ color: C.muted, fontWeight: 600, fontSize: 24, marginLeft: 6 }}>bảng “MeetingMind”</div>
      </div>
      <div style={{ background: "#101204", borderRadius: 18, padding: 18, backgroundColor: "#161a23", border: "1.5px solid #2c3446" }}>
        <div style={{ color: "#b6c2cf", fontWeight: 700, fontSize: 24, padding: "4px 8px 14px" }}>Việc từ cuộc họp</div>
        {t >= 0 ? (
          <div
            style={{
              background: "#22272b",
              borderRadius: 12,
              padding: "18px 20px",
              transform: `translateY(${(1 - s) * -140}px) rotate(${(1 - s) * -6}deg)`,
              opacity: Math.min(1, s * 1.5),
              boxShadow: `0 0 0 3px rgba(12,102,228,${glow}), 0 18px 40px -10px rgba(0,0,0,0.7)`,
            }}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <span style={{ width: 56, height: 10, borderRadius: 5, background: "#f5cd47" }} />
              <span style={{ width: 56, height: 10, borderRadius: 5, background: "#579dff" }} />
            </div>
            <div style={{ color: "#e6edf3", fontWeight: 700, fontSize: 28, lineHeight: 1.3 }}>{HERO.title}</div>
            <div style={{ color: "#9fadbc", fontSize: 20, marginTop: 14, lineHeight: 1.55 }}>
              <div>
                <b style={{ color: "#c7d1db" }}>Người thực hiện:</b> {HERO.assignee}
              </div>
              <div>
                <b style={{ color: "#c7d1db" }}>Hạn:</b> {HERO.deadline} · <b style={{ color: "#c7d1db" }}>Ưu tiên:</b> {HERO.priority}
              </div>
              <div>
                <b style={{ color: "#c7d1db" }}>Cuộc họp:</b> {HERO.meeting}
              </div>
              <div style={{ borderLeft: "3px solid #579dff", paddingLeft: 12, marginTop: 8, fontStyle: "italic" }}>“{HERO.quote}”</div>
            </div>
          </div>
        ) : null}
        <div style={{ color: "#8c9bab", fontSize: 20, padding: "14px 8px 2px" }}>+ Thêm thẻ</div>
      </div>
    </div>
  );
};

/** Bong bóng tin nhắn bot Telegram. */
export const TelegramBubble: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame - at;
  if (t < 0) return null;
  const s = spring({ frame: t, fps, config: { damping: 11, stiffness: 200, mass: 0.7 } });
  const lines: [string, string][] = [
    ["Người thực hiện", HERO.assignee],
    ["Hạn", HERO.deadline],
    ["Ưu tiên", HERO.priority],
    ["Cuộc họp", HERO.meeting],
  ];
  return (
    <div style={{ width: 640, fontFamily: FONT, transform: `scale(${s})`, transformOrigin: "0% 100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div style={{ width: 44, height: 44, borderRadius: 22, background: C.telegram, display: "grid", placeItems: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
            <path d="M21.5 3.5 2.8 10.7c-1.3.5-1.3 1.2-.2 1.6l4.8 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.4-1.5z" />
          </svg>
        </div>
        <div style={{ color: C.white, fontWeight: 800, fontSize: 34 }}>Telegram</div>
        <div style={{ color: C.muted, fontWeight: 600, fontSize: 24, marginLeft: 6 }}>bot MeetingMind</div>
      </div>
      <div
        style={{
          background: "#182533",
          borderRadius: "22px 22px 22px 6px",
          padding: "22px 26px",
          color: "#e9f1f8",
          fontSize: 24,
          lineHeight: 1.55,
          border: "1.5px solid #2b5278",
          boxShadow: "0 24px 60px -16px rgba(0,0,0,0.8), 0 0 40px rgba(42,171,238,0.25)",
        }}
      >
        <div style={{ fontWeight: 600 }}>🆕 Công việc mới từ cuộc họp</div>
        <div style={{ fontWeight: 800, fontSize: 27, margin: "4px 0 6px" }}>{HERO.title}</div>
        {lines.map(([k, v]) => (
          <div key={k} style={{ color: "#c5d3e0" }}>
            {k}: {v}
          </div>
        ))}
        <div style={{ color: "#6ab3f3", fontWeight: 600, marginTop: 6, textDecoration: "underline" }}>Mở thẻ Trello</div>
        <div style={{ textAlign: "right", color: "#6d8aa5", fontSize: 18, fontFamily: MONO }}>vừa xong ✓✓</div>
      </div>
    </div>
  );
};

/** Bảng mã JSON gõ nhanh (đúng tên trường của ai-worker: actionItems, assigneeHint, quote…). */
export const JsonPanel: React.FC<{ at: number; cps?: number }> = ({ at, cps = 3.2 }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0) return null;
  const code = [
    '"actionItems": [{',
    '  "title": "Hỏi khách về kênh gửi thông báo nhắc lịch",',
    '  "assigneeHint": "Administrator",',
    '  "priority": "medium",',
    '  "confidence": "high",',
    '  "quote": "Cái đó chị chưa hỏi khách, chị sẽ hỏi…"',
    "}]",
  ].join("\n");
  const n = Math.min(code.length, Math.floor(t * cps * 10));
  const shown = code.slice(0, n);
  const colorize = (s: string) =>
    s.split("\n").map((line, i) => {
      const m = line.match(/^(\s*)("[^"]*")(:\s*)(.*)$/);
      if (!m) return <div key={i} style={{ color: "#cdd8f0" }}>{line || " "}</div>;
      return (
        <div key={i}>
          {m[1]}
          <span style={{ color: C.sky }}>{m[2]}</span>
          <span style={{ color: "#cdd8f0" }}>{m[3]}</span>
          <span style={{ color: C.amber }}>{m[4]}</span>
        </div>
      );
    });
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: 31,
        lineHeight: 1.6,
        background: "rgba(5,10,22,0.92)",
        border: `1.5px solid ${C.ai}88`,
        borderRadius: 24,
        padding: "34px 44px",
        whiteSpace: "pre",
        width: 1180,
        height: 420,
        boxSizing: "border-box",
        boxShadow: `0 40px 90px -20px rgba(0,0,0,0.85), 0 0 60px ${C.ai}33`,
      }}
    >
      <div style={{ color: C.ai, fontWeight: 700, fontSize: 24, marginBottom: 10, fontFamily: FONT }}>✦ LLM → JSON có cấu trúc</div>
      {colorize(shown)}
    </div>
  );
};
