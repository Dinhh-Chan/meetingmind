/**
 * Đổi gợi ý của AI trong đề xuất công việc thành dữ liệu dùng được:
 * - assigneeHint ("Hoàng Nguyễn Trà Mi") → tài khoản người tham dự / thành viên dự án;
 * - deadlineRawText ("ngày 11", "thứ Sáu tuần sau") → ngày cụ thể theo ngày họp.
 *
 * Chỉ là điền sẵn cho người duyệt: đề xuất vẫn phải được duyệt mới thành task,
 * và người duyệt sửa lại được. Không chắc thì để trống, không đoán bừa.
 */

export interface PersonRef {
    userId: string;
    name: string;
}

/** Bỏ dấu, chữ thường; "y" và "i" coi như nhau (máy nhận dạng hay ghi "Mi" cho "My"). */
function tokensOf(name: string): string[] {
    return name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/gi, "d")
        .toLowerCase()
        .replace(/y/g, "i")
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
}

/**
 * Người ứng với tên AI gợi ý:
 * - mọi từ của tên gợi ý nằm trong tên đúng một người (bất kể thứ tự) → người đó;
 * - nằm trong tên nhiều người (chỉ gọi "My" khi có hai người tên My) → chỉ chọn
 *   khi có người trùng khít cả tên, không thì để trống;
 * - không nằm trọn trong tên ai → người trùng phần lớn số từ, nếu chỉ có một.
 */
export function matchPerson(hint: string | null | undefined, people: PersonRef[]): string | null {
    const wanted = [...new Set(tokensOf(hint ?? ""))];
    if (!wanted.length) return null;
    const scored = people
        .map((person) => {
            const have = new Set(tokensOf(person.name));
            const shared = wanted.filter((t) => have.has(t)).length;
            return {
                userId: person.userId,
                contained: have.size > 0 && shared === wanted.length,
                jaccard: have.size ? shared / (wanted.length + have.size - shared) : 0,
            };
        })
        .filter((c) => c.contained || c.jaccard >= 0.6);
    const unique = (list: typeof scored) => (new Set(list.map((c) => c.userId)).size === 1 ? list[0].userId : null);

    const contained = scored.filter((c) => c.contained);
    if (contained.length) return unique(contained) ?? unique(contained.filter((c) => c.jaccard === 1));
    const top = Math.max(0, ...scored.map((c) => c.jaccard));
    return scored.length ? unique(scored.filter((c) => c.jaccard === top)) : null;
}

const WEEKDAYS: [RegExp, number][] = [
    [/chu nhat|\bcn\b/, 0],
    [/thu (hai|2)\b/, 1],
    [/thu (ba|3)\b/, 2],
    [/thu (tu|4)\b/, 3],
    [/thu (nam|5)\b/, 4],
    [/thu (sau|6)\b/, 5],
    [/thu (bay|7)\b/, 6],
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const valid = (y: number, m: number, d: number) => {
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
};

/**
 * Ngày (YYYY-MM-DD) ứng với cụm chỉ hạn, tính từ ngày họp `base` (YYYY-MM-DD,
 * giờ Việt Nam). Hạn luôn từ ngày họp trở đi: "ngày 11" nói hôm 15 là ngày 11
 * tháng sau. Cụm mơ hồ ("tuần sau", "sớm nhất có thể") trả null để người duyệt chốt.
 */
export function resolveDeadline(raw: string | null | undefined, base: string): string | null {
    const [by, bm, bd] = base.split("-").map(Number);
    const start = valid(by, bm, bd);
    if (!raw || !start) return null;
    const text = raw
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/gi, "d")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    const plus = (days: number) => iso(new Date(start.getTime() + days * 86400000));

    // 11/11/2026, 11-11, ngày 15 tháng 11 (năm 2026)
    const full =
        text.match(/(\d{1,2})\s*[/\-.]\s*(\d{1,2})(?:\s*[/\-.]\s*(\d{4}))?/) ??
        text.match(/(?:ngay|mung|mong)?\s*(\d{1,2})\s*thang\s*(\d{1,2})(?:\s*nam\s*(\d{4}))?/);
    if (full) {
        const [d, m] = [Number(full[1]), Number(full[2])];
        if (full[3]) {
            const date = valid(Number(full[3]), m, d);
            return date ? iso(date) : null;
        }
        const thisYear = valid(by, m, d);
        if (thisYear && thisYear >= start) return iso(thisYear);
        const nextYear = valid(by + 1, m, d);
        return nextYear ? iso(nextYear) : null;
    }

    if (/\bhom nay\b/.test(text)) return plus(0);
    if (/\bngay kia\b|\bmot\b/.test(text)) return plus(2);
    if (/\bngay mai\b|\bmai\b/.test(text)) return plus(1);
    if (/cuoi thang/.test(text)) return iso(new Date(Date.UTC(by, bm, 0)));

    for (const [pattern, weekday] of WEEKDAYS) {
        if (!pattern.test(text)) continue;
        // Thứ gần nhất sau ngày họp; "tuần sau" thì là thứ đó của tuần kế (tuần bắt đầu thứ Hai).
        let ahead = (weekday - start.getUTCDay() + 7) % 7 || 7;
        if (/tuan sau|tuan toi/.test(text)) {
            const toNextMonday = (8 - start.getUTCDay()) % 7 || 7;
            ahead = toNextMonday + ((weekday + 6) % 7);
        }
        return plus(ahead);
    }

    // "ngày 11", "mùng 5", "hôm 21": ngày đó của tháng này, đã qua thì tháng sau.
    const day = text.match(/(?:ngay|mung|mong|hom)\s*(\d{1,2})\b/);
    if (day) {
        const d = Number(day[1]);
        for (let i = 0; i < 3; i++) {
            const date = valid(by + Math.floor((bm - 1 + i) / 12), ((bm - 1 + i) % 12) + 1, d);
            if (date && date >= start) return iso(date);
        }
    }
    return null;
}
