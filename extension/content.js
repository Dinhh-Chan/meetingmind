/**
 * Đọc phụ đề trực tiếp của Google Meet.
 *
 * KHÔNG ghi âm, KHÔNG có bot vào phòng. Chỉ đọc đúng phần phụ đề mà Meet đã
 * hiển thị trên màn hình của chính người dùng — nên có sẵn tên người nói.
 *
 * LƯU Ý: class trong DOM của Meet bị làm rối và Google đổi định kỳ. Vì vậy
 * code dò theo nhiều lớp dự phòng, và có `__mmDebug()` để tìm lại selector khi
 * hỏng. Xem README.md mục "Khi Meet đổi giao diện".
 */

const SETTLE_MS = 1500;

// Quét lại DOM theo chu kỳ thay vì gắn MutationObserver vào một container cố
// định: Meet gỡ và dựng lại vùng phụ đề mỗi khi im lặng một lúc, observer gắn
// vào node cũ sẽ nằm im mãi.
const SCAN_INTERVAL_MS = 400;

// Container phụ đề, thử lần lượt. Chỉ nhận vùng `role="region"`: trước đây có
// thêm `div.a4cQT` và `[aria-live="polite"]` làm dự phòng, nhưng lúc không ai
// nói vùng phụ đề rỗng nên code rơi xuống hai selector đó và đọc nhầm menu cài
// đặt ("language: Vietnamese") hay hộp thoại "Your meeting's ready" thành phụ đề.
const CAPTION_CONTAINER_SELECTORS = [
    '[role="region"][aria-label*="aption" i]',
    '[role="region"][aria-label*="Phụ đề" i]',
];

const { unsentPart } = globalThis.mmCaptionText;

let scanTimer = null;
let sessionStartAt = null;
/** node khối phụ đề -> { speaker, sent, live, startMs, timer } */
const tracked = new Map();

/** Vùng phụ đề có mặt khi đã bật CC, kể cả lúc chưa ai nói. */
function findCaptionContainer() {
    for (const selector of CAPTION_CONTAINER_SELECTORS) {
        const el = document.querySelector(selector);
        if (el) return { el, selector };
    }
    return null;
}

/**
 * Tách các khối phụ đề thành { node, speaker, text }.
 *
 * Meet dựng mỗi lượt nói thành một khối gồm tên người nói và phần text. Không
 * dựa vào tên class, mà dựa vào cấu trúc: khối con nào có từ hai vùng text
 * trở lên thì vùng đầu là tên, phần còn lại là nội dung.
 *
 * Lấy khối ngoài cùng rồi bỏ qua mọi div con của nó — Meet tách text thành
 * nhiều span, nếu không bỏ thì div chứa text bị đọc nhầm thành một khối với
 * từ đầu tiên làm tên người nói.
 */
function extractBlocks(container) {
    const blocks = [];
    const accepted = [];
    for (const node of container.querySelectorAll("div")) {
        if (accepted.some((a) => a.contains(node))) continue;
        const spans = [...node.children].filter(
            (c) => c.innerText && c.innerText.trim(),
        );
        if (spans.length < 2) continue;
        const speaker = spans[0].innerText.trim();
        const text = spans
            .slice(1)
            .map((s) => s.innerText.trim())
            .join(" ")
            .trim();
        // Tên người nói ngắn và không xuống dòng; lọc bớt khối rác.
        if (!speaker || !text || speaker.length > 60 || speaker.includes("\n")) {
            continue;
        }
        accepted.push(node);
        blocks.push({ node, speaker, text });
    }
    return blocks;
}

function emit(speaker, text, startMs) {
    try {
        chrome.runtime.sendMessage({
            type: "mm:segment",
            segment: {
                speakerLabel: speaker,
                displayName: speaker,
                startMs,
                endMs: Date.now() - sessionStartAt,
                text,
            },
        });
    } catch (err) {
        // Extension vừa được tải lại: script này đã mồ côi, phải tải lại tab.
        console.warn("[MeetingMind] Không gửi được đoạn phụ đề:", err.message);
        stop();
    }
}

/**
 * Gửi phần chưa gửi của một khối. Giữ lại trạng thái khối: Meet còn nối câu
 * mới vào chính khối này nếu cùng người nói tiếp.
 */
function settle(node) {
    const state = tracked.get(node);
    if (!state) return;
    clearTimeout(state.timer);
    const text = unsentPart(state.sent, state.live);
    state.sent = state.live;
    if (text) emit(state.speaker, text, state.startMs);
    state.startMs = null;
}

function scan() {
    const found = findCaptionContainer();
    const now = Date.now() - sessionStartAt;

    for (const { node, speaker, text } of found ? extractBlocks(found.el) : []) {
        let state = tracked.get(node);
        if (!state) {
            state = { speaker, sent: "", live: "", startMs: null, timer: null };
            tracked.set(node, state);
        }
        if (state.live === text) continue;

        state.live = text;
        state.startMs ??= now;
        clearTimeout(state.timer);
        // Text ngừng đổi -> coi như người đó nói xong câu này.
        state.timer = setTimeout(() => settle(node), SETTLE_MS);
    }

    // Khối đã bị Meet gỡ khỏi màn hình thì chốt luôn, không chờ hết hạn.
    for (const node of [...tracked.keys()]) {
        if (!node.isConnected) {
            settle(node);
            tracked.delete(node);
        }
    }
}

/**
 * Bắt đầu quét kể cả khi chưa thấy phụ đề: Meet gỡ vùng phụ đề lúc không ai
 * nói, nên bấm "Bắt đầu" giữa lúc im lặng là chuyện bình thường.
 */
function start() {
    stop();
    sessionStartAt = Date.now();
    scanTimer = setInterval(scan, SCAN_INTERVAL_MS);
    const captionsVisible = Boolean(findCaptionContainer());
    chrome.runtime.sendMessage({
        type: "mm:status",
        status: captionsVisible ? "watching" : "waiting-captions",
    });
    return { ok: true, captionsVisible };
}

/** Dừng và gửi nốt các lượt đang nói dở — trước đây phần này bị bỏ. */
function stop() {
    clearInterval(scanTimer);
    scanTimer = null;
    for (const node of tracked.keys()) settle(node);
    tracked.clear();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "mm:start") {
        sendResponse(start());
    } else if (msg.type === "mm:stop") {
        stop();
        sendResponse({ ok: true });
    } else if (msg.type === "mm:probe") {
        const found = findCaptionContainer();
        sendResponse({
            found: Boolean(found),
            selector: found?.selector,
            sample: found
                ? extractBlocks(found.el)
                      .slice(0, 3)
                      .map(({ speaker, text }) => ({ speaker, text }))
                : [],
        });
    }
    return true;
});

/**
 * Gọi trong DevTools console của tab Meet khi phụ đề không được nhận diện.
 * Content script chạy trong isolated world: phải chọn context "MeetingMind"
 * ở ô "top" của Console thì mới thấy hàm này.
 */
window.__mmDebug = () => {
    const found = findCaptionContainer();
    console.log("[MeetingMind] container:", found?.selector ?? "KHÔNG THẤY");
    if (found) console.log("[MeetingMind] khối đọc được:", extractBlocks(found.el));
    else
        console.log(
            "[MeetingMind] Bật phụ đề (nút CC) rồi chạy lại. Nếu vẫn không thấy, tìm phần tử bao quanh phụ đề trong Elements rồi thêm selector vào CAPTION_CONTAINER_SELECTORS.",
        );
    console.log("[MeetingMind] đang theo dõi", tracked.size, "khối, quét:", Boolean(scanTimer));
};
