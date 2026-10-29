// Chạy: node --test extension/test/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { unsentPart } = require("../caption-text.js");

/** Mô phỏng content.js: mỗi lần text đứng yên thì gửi phần chưa gửi. */
function replay(settledTexts) {
    let sent = "";
    const out = [];
    for (const live of settledTexts) {
        const part = unsentPart(sent, live);
        if (part) out.push(part);
        sent = live;
    }
    return out;
}

test("cùng một khối, người nói ngừng rồi nói tiếp: không lặp lại câu cũ", () => {
    // Dòng thời gian ghi trên Meet thật ngày 29/10/2026: một khối nMcdL duy nhất,
    // giữa các câu ngừng 8–12 giây.
    const segments = replay([
        "Alo alo alo.",
        "Alo alo alo. 1 2, 3, 4.",
        "Alo alo alo. 1 2, 3, 4. Mà để ý đâu anh mơ đang yêu ơi.",
        "Alo alo alo. 1 2, 3, 4. Mà để ý đâu anh mơ đang yêu ơi. Chẳng có cơn đau là say khi qua nắng.",
    ]);
    assert.deepEqual(segments, [
        "Alo alo alo.",
        "1 2, 3, 4.",
        "Mà để ý đâu anh mơ đang yêu ơi.",
        "Chẳng có cơn đau là say khi qua nắng.",
    ]);
});

test("text không đổi thì không gửi gì", () => {
    assert.equal(unsentPart("Xin chào.", "Xin chào."), "");
});

test("Meet cắt bớt dòng đầu của khối dài", () => {
    const sent = "Hôm nay chúng ta bàn về tiến độ dự án và phân công việc cho tuần sau.";
    const live = "dự án và phân công việc cho tuần sau. Anh Nam làm phần extension.";
    assert.equal(unsentPart(sent, live), "Anh Nam làm phần extension.");
});

test("Meet đổi dấu câu cuối khi nói tiếp: không gửi lại từ đã gửi", () => {
    assert.equal(unsentPart("Mà để ý.", "Mà để ý đâu?"), "đâu?");
});

test("Meet sửa một từ đã gửi: gửi lại từ chỗ bị sửa, không gửi nửa từ", () => {
    assert.equal(
        unsentPart("anh mơ đang.", "anh mơ đáng yêu anh."),
        "đáng yêu anh.",
    );
});

test("khối mới: gửi toàn bộ", () => {
    assert.equal(unsentPart("", "Alo."), "Alo.");
});
