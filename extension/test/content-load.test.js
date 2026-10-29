// Nạp các content script theo đúng thứ tự manifest vào chung một global scope,
// như Chrome làm với isolated world của extension. Bắt lỗi trùng khai báo giữa
// các file — lỗi này làm content.js không chạy mà popup chỉ báo "Không gọi
// được tab Meet".
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

test("content script nạp được và đăng ký listener", () => {
    const listeners = [];
    const context = vm.createContext({
        window: {},
        document: { querySelector: () => null },
        console,
        setInterval,
        clearInterval,
        setTimeout,
        clearTimeout,
        chrome: {
            runtime: {
                sendMessage: () => {},
                onMessage: { addListener: (fn) => listeners.push(fn) },
            },
        },
    });
    for (const file of manifest.content_scripts[0].js) {
        vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, {
            filename: file,
        });
    }
    assert.equal(listeners.length, 1);

    let probe;
    listeners[0]({ type: "mm:probe" }, null, (res) => (probe = res));
    // Object tạo trong vm thuộc realm khác: so từng trường thay vì deepEqual.
    assert.equal(probe.found, false);
    assert.equal(probe.sample.length, 0);
});
