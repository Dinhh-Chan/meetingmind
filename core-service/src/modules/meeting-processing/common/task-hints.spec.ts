import { matchPerson, resolveDeadline } from "./task-hints";

/** QA: nhận diện task chưa chuẩn — khớp tên AI gợi ý với tài khoản, đổi cụm chỉ hạn thành ngày. */
describe("task-hints", () => {
    const people = [
        { userId: "admin", name: "Administrator" },
        { userId: "my", name: "My Hoàng" },
        { userId: "tramy", name: "Trà My Hoàng Nguyễn" },
    ];

    it("khớp tên bị đảo thứ tự và sai My/Mi", () => {
        expect(matchPerson("Hoàng Nguyễn Trà Mi", people)).toBe("tramy");
        expect(matchPerson("Trà Nguyễn", people)).toBe("tramy");
        expect(matchPerson("my hoang", people)).toBe("my");
        expect(matchPerson("Administrator", people)).toBe("admin");
    });

    it("không chọn khi mơ hồ hoặc không có ai", () => {
        // "My" có ở cả hai người.
        expect(matchPerson("My", people)).toBeNull();
        expect(matchPerson("Anh Tuấn", people)).toBeNull();
        expect(matchPerson("", people)).toBeNull();
        expect(matchPerson(null, people)).toBeNull();
    });

    it("tên trùng khít hơn thì thắng", () => {
        expect(matchPerson("My Hoàng", people)).toBe("my");
    });

    // Ngày họp: thứ Tư 11/11/2026.
    const base = "2026-11-11";
    it.each([
        ["ngày 11", "2026-11-11"],
        ["ngày 21", "2026-11-21"],
        ["ngày 5", "2026-12-05"],
        ["mùng 3", "2026-12-03"],
        ["18/11", "2026-11-18"],
        ["05/01", "2027-01-05"],
        ["ngày 15 tháng 11", "2026-11-15"],
        ["20-12-2026", "2026-12-20"],
        ["hôm nay", "2026-11-11"],
        ["ngày mai", "2026-11-12"],
        ["thứ Sáu", "2026-11-13"],
        ["thứ 4", "2026-11-18"],
        ["thứ hai tuần sau", "2026-11-16"],
        ["chủ nhật tuần sau", "2026-11-22"],
        ["cuối tháng", "2026-11-30"],
    ])("%s → %s", (raw, expected) => {
        expect(resolveDeadline(raw, base)).toBe(expected);
    });

    it("cụm mơ hồ hoặc ngày không có thật thì để người duyệt chốt", () => {
        expect(resolveDeadline("tuần sau", base)).toBeNull();
        expect(resolveDeadline("sớm nhất có thể", base)).toBeNull();
        expect(resolveDeadline("31/02", base)).toBeNull();
        expect(resolveDeadline(null, base)).toBeNull();
    });

    it("ngày 31 nhảy qua tháng không có ngày 31", () => {
        expect(resolveDeadline("ngày 31", "2026-11-11")).toBe("2026-12-31");
    });
});
