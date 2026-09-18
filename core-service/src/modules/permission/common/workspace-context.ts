import { Request } from "express";

export const WORKSPACE_HEADER = "x-workspace-id";
export const PROJECT_HEADER = "x-project-id";
export const MEETING_HEADER = "x-meeting-id";

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
 * Ưu tiên header; nếu không có thì lấy từ body hoặc từ
 * `?condition={"workspaceId":"..."}`.
 *
 * Với request multipart, multer chạy **sau** guard nên `req.body` còn rỗng —
 * những route đó bắt buộc phải truyền phạm vi qua header.
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
            pick(req.headers[PROJECT_HEADER]) ??
            pick(body.projectId) ??
            pick(condition.projectId) ??
            pick(query.projectId),
        meetingId:
            pick(req.headers[MEETING_HEADER]) ??
            pick(body.meetingId) ??
            pick(condition.meetingId) ??
            pick(query.meetingId),
    };
};
