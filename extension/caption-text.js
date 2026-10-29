/**
 * Phần xử lý text phụ đề không đụng tới DOM — tách riêng để test bằng node.
 *
 * Content script MV3 không dùng được `import`, nên file này được nạp trước
 * content.js (xem manifest) và gắn hàm lên `globalThis`.
 *
 * Bọc trong IIFE: các content script của cùng extension chung một global
 * scope, khai báo `unsentPart` ở ngoài cùng sẽ đụng với `const { unsentPart }`
 * trong content.js và làm content.js lỗi cú pháp, không chạy dòng nào.
 */
(() => {
// Đủ dài để không khớp nhầm một cụm từ lặp lại như "alo alo".
const TAIL_LEN = 24;

function commonPrefixLength(a, b) {
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
}

/**
 * Phần text của một khối phụ đề chưa được gửi đi.
 *
 * Meet giữ nguyên một khối cho cùng một người nói kể cả khi người đó ngừng
 * hàng chục giây, câu mới chỉ nối vào sau. Trước đây mỗi lần text đứng yên là
 * gửi cả khối, nên transcript bị lặp chồng: "A", "A B", "A B C".
 *
 * `sent` là toàn bộ text khối lúc gửi lần trước, `live` là text hiện tại.
 * Ba kiểu thay đổi:
 * - nói tiếp: `live` kéo dài `sent`;
 * - khối quá dài, Meet cắt bớt dòng đầu: đuôi của `sent` nằm giữa `live`;
 * - Meet sửa lại vài từ đã gửi: gửi lại từ chỗ bị sửa, chịu lặp vài từ còn
 *   hơn mất chữ.
 */
function unsentPart(sent, live) {
    if (live.startsWith(sent)) return live.slice(sent.length).trim();

    const tail = sent.slice(-TAIL_LEN);
    const at = tail.length === TAIL_LEN ? live.lastIndexOf(tail) : -1;
    if (at >= 0) return live.slice(at + TAIL_LEN).trim();

    // Lùi về đầu từ để không gửi nửa từ, trừ khi chỗ khác nhau đã là ranh giới
    // từ ("ý." thành "ý đâu?").
    const p = commonPrefixLength(sent, live);
    const atBoundary = p === 0 || /\s/.test(live[p - 1]) || /\s/.test(live[p] ?? " ");
    const from = atBoundary ? p : live.lastIndexOf(" ", p) + 1;
    return live.slice(from).replace(/^[\s.,!?…]+/, "").trim();
}

globalThis.mmCaptionText = { unsentPart };
if (typeof module !== "undefined") module.exports = { unsentPart };
})();
