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

// Ứng viên container phụ đề, thử lần lượt.
const CAPTION_CONTAINER_SELECTORS = [
    '[role="region"][aria-label*="aption" i]',
    '[aria-label*="Phụ đề" i]',
    "div.a4cQT",
    '[aria-live="polite"]',
];

let observer = null;
let sessionStartAt = null;
/** speakerLabel -> { text, startMs, timer } của lượt nói đang diễn ra */
const pending = new Map();

function findCaptionContainer() {
    for (const selector of CAPTION_CONTAINER_SELECTORS) {
        const el = document.querySelector(selector);
        if (el) return { el, selector };
    }
    return null;
}

/**
 * Tách các khối phụ đề thành { speaker, text }.
 *
 * Meet dựng mỗi lượt nói thành một khối gồm tên người nói và phần text. Không
 * dựa vào tên class, mà dựa vào cấu trúc: khối con nào có đúng hai vùng text
 * thì vùng ngắn phía trên là tên, vùng dài phía dưới là nội dung.
 */
function extractBlocks(container) {
    const blocks = [];
    for (const node of container.querySelectorAll(":scope > div, :scope div")) {
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
        // Tên người nói ngắn và không có dấu câu kết thúc; lọc bớt khối rác.
        if (!speaker || !text || speaker.length > 60) continue;
        blocks.push({ speaker, text });
    }
    return blocks;
}

function emit(speaker, text, startMs) {
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
}

function onCaptionChange(container) {
    const now = Date.now() - sessionStartAt;
    for (const { speaker, text } of extractBlocks(container)) {
        const current = pending.get(speaker);

        if (current && current.text === text) continue;

        if (current) {
            clearTimeout(current.timer);
        }
        const startMs = current ? current.startMs : now;
        const timer = setTimeout(() => {
            // Text ngừng đổi -> coi như người đó nói xong lượt này.
            emit(speaker, text, startMs);
            pending.delete(speaker);
        }, SETTLE_MS);

        pending.set(speaker, { text, startMs, timer });
    }
}

function start() {
    const found = findCaptionContainer();
    if (!found) {
        chrome.runtime.sendMessage({
            type: "mm:status",
            status: "no-captions",
        });
        return false;
    }
    sessionStartAt = Date.now();
    observer = new MutationObserver(() => onCaptionChange(found.el));
    observer.observe(found.el, {
        childList: true,
        subtree: true,
        characterData: true,
    });
    chrome.runtime.sendMessage({
        type: "mm:status",
        status: "watching",
        selector: found.selector,
    });
    return true;
}

function stop() {
    if (observer) observer.disconnect();
    observer = null;
    for (const { timer } of pending.values()) clearTimeout(timer);
    pending.clear();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "mm:start") {
        sendResponse({ ok: start() });
    } else if (msg.type === "mm:stop") {
        stop();
        sendResponse({ ok: true });
    } else if (msg.type === "mm:probe") {
        const found = findCaptionContainer();
        sendResponse({
            found: Boolean(found),
            selector: found?.selector,
            sample: found ? extractBlocks(found.el).slice(0, 3) : [],
        });
    }
    return true;
});

/**
 * Gọi trong DevTools console của tab Meet khi phụ đề không được nhận diện.
 * In ra vùng nào đang thay đổi để tìm selector mới.
 */
window.__mmDebug = () => {
    const found = findCaptionContainer();
    console.log("[MeetingMind] container:", found?.selector ?? "KHÔNG THẤY");
    if (found) console.log("[MeetingMind] khối đọc được:", extractBlocks(found.el));
    else
        console.log(
            "[MeetingMind] Bật phụ đề (nút CC) rồi chạy lại. Nếu vẫn không thấy, tìm phần tử bao quanh phụ đề trong Elements rồi thêm selector vào CAPTION_CONTAINER_SELECTORS.",
        );
};
