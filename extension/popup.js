const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

function showError(text, ok = false) {
    $("err").textContent = text || "";
    $("err").className = ok ? "err ok" : "err";
}

async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

async function render() {
    const s = await chrome.storage.local.get([
        "accessToken", "workspaceId", "meetingId", "meetingTitle",
        "captureStatus", "sentCount", "lastError", "apiUrl",
    ]);
    const loggedIn = Boolean(s.accessToken);
    $("login").classList.toggle("hidden", loggedIn);
    $("session").classList.toggle("hidden", !loggedIn);
    if (s.apiUrl) $("apiUrl").value = s.apiUrl;
    if (s.workspaceId) $("workspaceId").value = s.workspaceId;
    $("status").textContent = s.meetingId
        ? `đang ghi · ${s.captureStatus || "?"}`
        : "chưa chạy";
    $("sent").textContent = s.sentCount || 0;
    if (s.lastError) showError(s.lastError);
}

$("btnLogin").onclick = async () => {
    showError("");
    const res = await send({
        type: "mm:login",
        apiUrl: $("apiUrl").value.replace(/\/$/, ""),
        username: $("username").value,
        password: $("password").value,
    });
    if (!res?.ok) return showError(res?.error || "Đăng nhập thất bại");
    render();
};

$("btnStart").onclick = async () => {
    showError("");
    const tab = await activeTab();
    if (!tab.url?.includes("meet.google.com")) {
        return showError("Mở tab Google Meet rồi bấm lại.");
    }
    const res = await send({
        type: "mm:startSession",
        workspaceId: $("workspaceId").value.trim(),
        meetingUrl: tab.url.split("?")[0],
        title: $("title").value.trim() || undefined,
    });
    if (!res?.ok) return showError(res?.error || "Không tạo được phiên");

    const started = await chrome.tabs.sendMessage(tab.id, { type: "mm:start" });
    if (!started?.ok) {
        return showError(
            "Chưa thấy phụ đề. Bật nút CC trong Meet rồi bấm lại.\n" +
            "Meet đổi giao diện thì mở DevTools tab Meet, chạy __mmDebug().",
        );
    }
    showError("Đang ghi. Có thể đóng cửa sổ này.", true);
    render();
};

$("btnProbe").onclick = async () => {
    const tab = await activeTab();
    try {
        const res = await chrome.tabs.sendMessage(tab.id, { type: "mm:probe" });
        showError(
            res.found
                ? `Thấy phụ đề qua: ${res.selector}\n` +
                  res.sample.map((b) => `${b.speaker}: ${b.text}`).join("\n")
                : "Không thấy vùng phụ đề. Bật nút CC trong Meet.",
            res.found,
        );
    } catch {
        showError("Không gọi được tab Meet. Tải lại trang Meet rồi thử lại.");
    }
};

$("btnEnd").onclick = async () => {
    const tab = await activeTab();
    try { await chrome.tabs.sendMessage(tab.id, { type: "mm:stop" }); } catch {}
    const res = await send({ type: "mm:endSession" });
    showError(res?.ok ? "Đã chốt. Vào MeetingMind xem biên bản nháp." : res?.error, res?.ok);
    render();
};

render();
