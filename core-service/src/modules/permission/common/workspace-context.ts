import { Request } from "express";

export const WORKSPACE_HEADER = "x-workspace-id";

export interface WorkspaceContext {
    workspaceId: string;
    projectId?: string;
    meetingId?: string;
}

const pick = (value: unknown): string | undefined =>
    typeof value === "string" && value.length ? value : undefined;

/**
 * Lấy phạm vi đang thao tác từ request.
 *
 * Ưu tiên header `x-workspace-id`; nếu không có thì lấy từ body hoặc từ
 * `?condition={"workspaceId":"..."}`. Cho phép lấy từ body/query để client
 * hiện tại không phải sửa ngay, nhưng header là cách khuyến nghị vì nó áp
 * dụng đồng nhất cho cả route không có body.
 */
export const resolveWorkspaceContext = (
    req: Request,
): WorkspaceContext | null => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const query = (req.query ?? {}) as Record<string, unknown>;

    let condition: Record<string, unknown> = {};
    if (typeof query.condition === "string") {
        try {
            condition = JSON.parse(query.condition);
        } catch {
            condition = {};
        }
    }

    const workspaceId =
        pick(req.headers[WORKSPACE_HEADER]) ??
        pick(body.workspaceId) ??
        pick(condition.workspaceId) ??
        pick(query.workspaceId);

    if (!workspaceId) {
        return null;
    }

    return {
        workspaceId,
        projectId:
            pick(body.projectId) ??
            pick(condition.projectId) ??
            pick(query.projectId),
        meetingId:
            pick(body.meetingId) ??
            pick(condition.meetingId) ??
            pick(query.meetingId),
    };
};
