import { ActionItemStatus } from "@module/action-item/common/constant";
import type { ActionItem } from "@module/action-item/entities/action-item.entity";
import { RiskSeverity, RiskType } from "../common/constant";
import type { RiskFlag } from "../entities/risk-flag.entity";

/** Ngày theo giờ Việt Nam, dạng YYYY-MM-DD. */
export const vnDay = (d: Date | string | number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(d));

const daysBetween = (from: string, to: string) =>
    Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 864e5);

/** Nhiều deadline dồn vào một người trong một ngày (chỉ là dấu hiệu cần rà soát). */
export const CONFLICT_THRESHOLD = 5;

export type DetectedRisk = Pick<
    RiskFlag,
    "workspaceId" | "projectId" | "meetingId" | "userId" | "actionItemId" | "type" | "severity" | "title" | "description" | "ruleKey" | "evidence" | "dedupKey"
>;

/**
 * Quy tắc cảnh báo (§6.11), cùng luật bản web: quá hạn, phụ thuộc chưa xong, dồn
 * deadline. Hàm thuần để test được; "bị chặn" không phải rủi ro suy luận mà là
 * trạng thái task nên giao diện tự hiện.
 */
export function detectRisks(
    tasks: ActionItem[],
    dependencies: { actionItemId: string; dependsOnActionItemId: string }[],
    today: string,
    nameOf: (userId: string) => string,
): DetectedRisk[] {
    const out: DetectedRisk[] = [];
    const open = tasks.filter((t) => t.status !== ActionItemStatus.DONE && !t.deletedAt);
    const byId = new Map(tasks.map((t) => [t._id, t]));
    const base = (t: ActionItem) => ({
        workspaceId: t.workspaceId,
        projectId: t.projectId ?? null,
        meetingId: t.meetingId ?? null,
        userId: t.assigneeId ?? null,
        actionItemId: t._id,
    });

    for (const t of open) {
        if (!t.deadline) continue;
        const due = vnDay(t.deadline);
        const late = daysBetween(due, today);
        if (late <= 0) continue;
        out.push({
            ...base(t),
            type: RiskType.OVERDUE,
            severity: late > 7 ? RiskSeverity.CRITICAL : late > 3 ? RiskSeverity.HIGH : RiskSeverity.MEDIUM,
            title: `Task quá hạn ${late} ngày`,
            description: `"${t.title}" hạn ${due.split("-").reverse().join("/")}, chưa xong.`,
            ruleKey: "task.overdue",
            evidence: { deadline: due, daysLate: late, status: t.status },
            dedupKey: `overdue|${t._id}`,
        });
    }

    for (const d of dependencies) {
        const task = byId.get(d.actionItemId);
        const dep = byId.get(d.dependsOnActionItemId);
        if (!task || !dep || task.status === ActionItemStatus.DONE || dep.status === ActionItemStatus.DONE) continue;
        out.push({
            ...base(task),
            type: RiskType.BLOCKED_DEPENDENCY,
            severity: RiskSeverity.MEDIUM,
            title: "Phụ thuộc chưa xong",
            description: `Chờ: ${dep.title}`,
            ruleKey: "task.dependency_open",
            evidence: { dependsOn: dep._id, dependsOnTitle: dep.title, dependsOnStatus: dep.status },
            dedupKey: `dependency|${task._id}|${dep._id}`,
        });
    }

    const perDay = new Map<string, ActionItem[]>();
    for (const t of open) {
        if (!t.assigneeId || !t.deadline) continue;
        const key = `${t.assigneeId}|${vnDay(t.deadline)}`;
        perDay.set(key, [...(perDay.get(key) ?? []), t]);
    }
    for (const [key, list] of perDay) {
        if (list.length < CONFLICT_THRESHOLD) continue;
        const [userId, day] = key.split("|");
        out.push({
            workspaceId: list[0].workspaceId,
            projectId: null,
            meetingId: null,
            userId,
            actionItemId: null,
            type: RiskType.DEADLINE_CONFLICT,
            severity: RiskSeverity.MEDIUM,
            title: `${nameOf(userId)} có ${list.length} deadline ngày ${day.split("-").reverse().join("/")}`,
            description: "Nhiều deadline cùng ngày cho một người — cần rà soát, chưa kết luận quá tải.",
            ruleKey: "assignee.deadline_conflict",
            evidence: { count: list.length, day, tasks: list.map((t) => t._id) },
            dedupKey: `conflict|${userId}|${day}`,
        });
    }
    return out;
}

