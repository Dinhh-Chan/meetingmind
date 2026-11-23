import { ActionItemStatus } from "@module/action-item/common/constant";
import { ActionItem } from "@module/action-item/entities/action-item.entity";
import { RiskType } from "./common/constant";
import { CONFLICT_THRESHOLD, detectRisks } from "./services/risk-rules";

const task = (id: string, o: Partial<ActionItem> = {}) =>
    ({
        _id: id,
        workspaceId: "w",
        projectId: "p",
        title: `Task ${id}`,
        status: ActionItemStatus.TODO,
        assigneeId: "u1",
        ...o,
    }) as ActionItem;

// 2026-11-23 theo giờ Việt Nam.
const TODAY = "2026-11-23";
const at = (day: string) => new Date(`${day}T10:00:00+07:00`);

describe("detectRisks", () => {
    it("quá hạn: theo ngày giờ Việt Nam, bỏ task đã xong, mức độ theo số ngày trễ", () => {
        const risks = detectRisks(
            [
                task("a", { deadline: at("2026-11-20") }),
                task("b", { deadline: at("2026-11-23") }),
                task("c", { deadline: at("2026-11-01"), status: ActionItemStatus.DONE }),
                task("d", { deadline: at("2026-11-10") }),
            ],
            [],
            TODAY,
            () => "Nam",
        );
        expect(risks.map((r) => [r.dedupKey, r.title, r.severity])).toEqual([
            ["overdue|a", "Task quá hạn 3 ngày", "medium"],
            ["overdue|d", "Task quá hạn 13 ngày", "critical"],
        ]);
    });

    it("phụ thuộc chưa xong", () => {
        const risks = detectRisks(
            [task("a"), task("b", { title: "API đăng nhập" }), task("c", { status: ActionItemStatus.DONE })],
            [
                { actionItemId: "a", dependsOnActionItemId: "b" },
                { actionItemId: "a", dependsOnActionItemId: "c" },
            ],
            TODAY,
            () => "Nam",
        );
        expect(risks).toHaveLength(1);
        expect(risks[0]).toMatchObject({ type: RiskType.BLOCKED_DEPENDENCY, description: "Chờ: API đăng nhập" });
    });

    it(`dồn deadline: từ ${CONFLICT_THRESHOLD} task cùng người cùng ngày`, () => {
        const many = Array.from({ length: CONFLICT_THRESHOLD }, (_, i) => task(`t${i}`, { deadline: at("2026-11-28") }));
        const risks = detectRisks(many, [], TODAY, () => "Nam");
        expect(risks.map((r) => r.title)).toEqual([`Nam có ${CONFLICT_THRESHOLD} deadline ngày 28/11/2026`]);
        expect(detectRisks(many.slice(1), [], TODAY, () => "Nam")).toEqual([]);
    });
});
