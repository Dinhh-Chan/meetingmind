/**
 * Gom phụ đề từ content script rồi gửi về core-service theo lô.
 *
 * Giữ ở service worker thay vì content script vì tab Meet có thể bị Chrome
 * treo bớt tài nguyên, còn phiên làm việc thì phải sống suốt cuộc họp.
 */

import { DEFAULT_API, FLUSH_INTERVAL_MS } from "./config.js";

let buffer = [];
let flushTimer = null;

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

async function flush() {
    if (!buffer.length) return;
    const { meetingId, workspaceId } = await store.get([
        "meetingId",
        "workspaceId",
    ]);
    if (!meetingId) return;

    const segments = buffer;
    buffer = [];
    try {
        await api("/meeting-processing/live-transcript", {
            body: { workspaceId, meetingId, segments },
        });
        const { sentCount = 0 } = await store.get(["sentCount"]);
        await store.set({ sentCount: sentCount + segments.length });
    } catch (err) {
        // Gửi lỗi thì trả lại buffer, lần sau gửi tiếp — không mất phụ đề.
        buffer = segments.concat(buffer);
        await store.set({ lastError: err.message });
    }
}

function startFlushLoop() {
    if (flushTimer) return;
    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
}

function stopFlushLoop() {
    clearInterval(flushTimer);
    flushTimer = null;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    (async () => {
        switch (msg.type) {
            case "mm:segment":
                buffer.push(msg.segment);
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
                    });
                    startFlushLoop();
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
                    stopFlushLoop();
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
