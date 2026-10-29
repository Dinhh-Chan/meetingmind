/**
 * Gom phụ đề từ content script rồi gửi về core-service theo lô.
 *
 * Giữ ở service worker thay vì content script vì tab Meet có thể bị Chrome
 * treo bớt tài nguyên, còn phiên làm việc thì phải sống suốt cuộc họp.
 */

import { DEFAULT_API, FLUSH_INTERVAL_MS } from "./config.js";

// Buffer nằm trong storage chứ không trong biến: Chrome tắt service worker
// MV3 sau ~30 giây không có sự kiện, biến trong bộ nhớ và setInterval mất theo.
// Trước đây vì vậy mà phụ đề cứ nằm trong buffer, không bao giờ được gửi đi.
let flushTimer = null;
let queue = Promise.resolve();

/** Chạy tuần tự các thao tác đọc-sửa-ghi buffer để không ghi đè lẫn nhau. */
function serial(fn) {
    const next = queue.then(fn, fn);
    queue = next.catch(() => {});
    return next;
}

const store = {
    async get(keys) {
        return chrome.storage.local.get(keys);
    },
    async set(values) {
        return chrome.storage.local.set(values);
    },
};

async function api(path, { method = "POST", body, retryOn401 = true } = {}) {
    const { apiUrl, accessToken, workspaceId } = await store.get([
        "apiUrl",
        "accessToken",
        "workspaceId",
    ]);
    const res = await fetch(`${apiUrl || DEFAULT_API}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "x-workspace-id": workspaceId || "",
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && retryOn401) {
        // Token hết hạn giữa cuộc họp là chuyện thường: JWT_EXP mặc định 1 giờ.
        if (await refresh()) {
            return api(path, { method, body, retryOn401: false });
        }
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
        throw new Error(json.message || `HTTP ${res.status}`);
    }
    return json.data;
}

async function refresh() {
    const { apiUrl, refreshToken } = await store.get(["apiUrl", "refreshToken"]);
    if (!refreshToken) return false;
    try {
        const res = await fetch(`${apiUrl || DEFAULT_API}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
        });
        const json = await res.json();
        if (!res.ok || !json?.data?.accessToken) return false;
        await store.set({
            accessToken: json.data.accessToken,
            refreshToken: json.data.refreshToken || refreshToken,
        });
        return true;
    } catch {
        return false;
    }
}

function flush() {
    return serial(async () => {
    const { meetingId, workspaceId, buffer = [] } = await store.get([
        "meetingId",
        "workspaceId",
        "buffer",
    ]);
    if (!meetingId || !buffer.length) return;

    const segments = buffer;
    await store.set({ buffer: [] });
    try {
        await api("/meeting-processing/live-transcript", {
            body: { workspaceId, meetingId, segments },
        });
        const { sentCount = 0 } = await store.get(["sentCount"]);
        await store.set({ sentCount: sentCount + segments.length });
    } catch (err) {
        // Gửi lỗi thì trả lại buffer, lần sau gửi tiếp — không mất phụ đề.
        const { buffer: rest = [] } = await store.get(["buffer"]);
        await store.set({ buffer: segments.concat(rest), lastError: err.message });
        scheduleFlush();
    }
    });
}

/**
 * Hẹn gửi sau FLUSH_INTERVAL_MS. Gọi mỗi khi có đoạn mới: chính sự kiện đó
 * đánh thức service worker, nên hẹn giờ ngắn luôn chạy kịp trước khi bị tắt.
 */
function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
    }, FLUSH_INTERVAL_MS);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
        switch (msg.type) {
            case "mm:segment":
                await serial(async () => {
                    const { buffer = [] } = await store.get(["buffer"]);
                    await store.set({ buffer: [...buffer, msg.segment] });
                });
                scheduleFlush();
                sendResponse({ ok: true });
                break;

            case "mm:status":
                await store.set({ captureStatus: msg.status });
                sendResponse({ ok: true });
                break;

            case "mm:login": {
                const res = await fetch(`${msg.apiUrl}/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        username: msg.username,
                        password: msg.password,
                        platform: "Web",
                    }),
                });
                const json = await res.json();
                if (!json?.data?.accessToken) {
                    sendResponse({ ok: false, error: "Sai tài khoản hoặc mật khẩu" });
                    break;
                }
                await store.set({
                    apiUrl: msg.apiUrl,
                    accessToken: json.data.accessToken,
                    refreshToken: json.data.refreshToken,
                });
                sendResponse({ ok: true });
                break;
            }

            case "mm:startSession": {
                try {
                    const meeting = await api(
                        "/meeting-processing/live-session/start",
                        {
                            body: {
                                workspaceId: msg.workspaceId,
                                meetingUrl: msg.meetingUrl,
                                title: msg.title,
                                platform: "google_meet",
                                language: "vi",
                            },
                        },
                    );
                    await store.set({
                        workspaceId: msg.workspaceId,
                        meetingId: meeting._id,
                        meetingTitle: meeting.title,
                        sentCount: 0,
                        lastError: "",
                        buffer: [],
                    });
                    sendResponse({ ok: true, meeting });
                } catch (err) {
                    sendResponse({ ok: false, error: err.message });
                }
                break;
            }

            case "mm:endSession": {
                try {
                    await flush();
                    const { workspaceId, meetingId } = await store.get([
                        "workspaceId",
                        "meetingId",
                    ]);
                    await api("/meeting-processing/live-transcript/finalize", {
                        body: { workspaceId, meetingId },
                    });
                    clearTimeout(flushTimer);
                    flushTimer = null;
                    await store.set({ meetingId: "", captureStatus: "idle" });
                    sendResponse({ ok: true });
                } catch (err) {
                    sendResponse({ ok: false, error: err.message });
                }
                break;
            }

            default:
                sendResponse({ ok: false, error: "lệnh lạ" });
        }
    })();
    return true;
});
