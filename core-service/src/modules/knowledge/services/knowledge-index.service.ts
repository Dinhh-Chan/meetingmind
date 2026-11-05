import { ActionItem } from "@module/action-item/entities/action-item.entity";
import { Decision } from "@module/decision/entities/decision.entity";
import { MediaFile } from "@module/media-file/entities/media-file.entity";
import { Meeting } from "@module/meeting/entities/meeting.entity";
import {
    AnalysisSegment,
    EventType,
    KnowledgeDeleteRequestedPayload,
    KnowledgeIndexRequestedPayload,
    KnowledgeItem,
    KnowledgeSourceType,
} from "@module/messaging/common/constant";
import { OutboxService } from "@module/messaging/services/outbox.service";
import { MinutesVersion } from "@module/minutes-version/entities/minutes-version.entity";
import { UserService } from "@module/user/service/user.service";
import { Injectable } from "@nestjs/common";
import { basename } from "path";

export type KnowledgeMeeting = Pick<
    Meeting,
    | "_id"
    | "workspaceId"
    | "projectId"
    | "title"
    | "actualStartAt"
    | "scheduledStartAt"
>;

/** Nội dung đề xuất AI lúc duyệt; bảng chính thức không giữ mô tả và câu gốc. */
export interface ReviewExtra {
    description?: string;
    quote?: string;
    assigneeHint?: string;
    /** Truyền sẵn khi lập lại hàng loạt, khỏi tra người dùng từng task. */
    assigneeName?: string;
}

/** Lấy phần mô tả, câu gốc từ payload đề xuất đã duyệt (có thể không còn). */
export function reviewExtraOf(payload: unknown): ReviewExtra {
    const p = (payload ?? {}) as Record<string, unknown>;
    const text = (v: unknown) =>
        typeof v === "string" && v.trim() ? v : undefined;
    return {
        description: text(p.description),
        quote: text(p.quote),
        assigneeHint: text(p.assigneeHint),
    };
}

/**
 * Ngày diễn ra cuộc họp để AI ghi kèm nguồn: giờ bắt đầu thật, chưa họp thì
 * giờ hẹn, không có cả hai thì lúc tạo — cùng thứ tự giao diện dùng.
 */
export function meetingDateOf(
    meeting: Pick<Meeting, "actualStartAt" | "scheduledStartAt">,
): string | undefined {
    const at =
        meeting.actualStartAt ??
        meeting.scheduledStartAt ??
        (meeting as { createdAt?: Date | string }).createdAt;
    return at ? new Date(at).toISOString() : undefined;
}

const PRIORITY_LABEL: Record<string, string> = {
    low: "thấp",
    medium: "trung bình",
    high: "cao",
    urgent: "khẩn",
};

const TASK_STATUS_LABEL: Record<string, string> = {
    todo: "chưa làm",
    in_progress: "đang làm",
    blocked: "bị chặn",
    done: "đã xong",
};

const DECISION_STATUS_LABEL: Record<string, string> = {
    proposed: "đề xuất",
    agreed: "đã thống nhất",
    superseded: "đã bị thay thế",
};

// Hạn lưu theo giờ máy chủ; định dạng cố định múi giờ VN để câu trả lời không lệch ngày.
const dayFormat = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
});

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Gửi nội dung đã chính thức sang ai-worker để lập chỉ mục hỏi đáp.
 *
 * Chỉ thứ đã qua người duyệt mới vào kho (biên bản đã duyệt, quyết định và
 * công việc đã duyệt) cùng transcript và tài liệu; nháp của AI thì không, để
 * câu trả lời không dựa trên đề xuất đã bị loại. Đi qua outbox như mọi lệnh
 * khác: ai-worker chết thì lệnh nằm lại, không mất.
 */
@Injectable()
export class KnowledgeIndexService {
    constructor(
        private readonly outboxService: OutboxService,
        private readonly userService: UserService,
    ) {}

    /** Trả về false khi không có gì để lập (transcript rỗng). */
    async indexTranscript(
        meeting: KnowledgeMeeting,
        version: { _id: string; versionNo?: number },
        segments: AnalysisSegment[],
    ): Promise<boolean> {
        const items: KnowledgeItem[] = segments
            .filter((s) => s.text?.trim())
            .map((s) => ({
                text: s.text,
                speaker: s.speaker,
                startMs: s.startMs,
                endMs: s.endMs,
            }));
        if (!items.length) return false;
        await this.emit(meeting, "transcript", version._id, items, {
            sourceVersion: version.versionNo
                ? String(version.versionNo)
                : undefined,
        });
        return true;
    }

    /** Biên bản đã duyệt: tóm tắt, vấn đề còn mở và các mục soạn thêm nếu có. */
    async indexMinutes(
        meeting: KnowledgeMeeting,
        version: Pick<
            MinutesVersion,
            "_id" | "versionNo" | "summary" | "openIssues" | "editorContent"
        >,
    ): Promise<boolean> {
        const items: KnowledgeItem[] = [];
        if (str(version.summary)) {
            items.push({ title: "Tóm tắt", text: str(version.summary) });
        }
        for (const issue of version.openIssues ?? []) {
            const text = [str(issue?.title), str(issue?.description)]
                .filter(Boolean)
                .join("\n");
            if (text) items.push({ title: "Vấn đề còn mở", text });
        }
        items.push(...editorSections(version.editorContent));
        if (!items.length) return false;
        await this.emit(meeting, "minutes", version._id, items, {
            sourceVersion: String(version.versionNo),
        });
        return true;
    }

    async indexDecision(
        meeting: KnowledgeMeeting,
        decision: Pick<Decision, "_id" | "title" | "description" | "status">,
        extra: ReviewExtra = {},
    ) {
        const lines = [
            decision.title,
            str(decision.description) || str(extra.description),
            decision.status
                ? `Trạng thái: ${DECISION_STATUS_LABEL[decision.status] ?? decision.status}`
                : "",
            str(extra.quote) ? `Trích lời: "${str(extra.quote)}"` : "",
        ];
        await this.emit(meeting, "decision", decision._id, [
            { title: decision.title, text: lines.filter(Boolean).join("\n") },
        ]);
    }

    /**
     * Công việc kèm người làm, hạn, trạng thái bằng chữ: câu hỏi kiểu "ai làm
     * gì, hạn khi nào" trả lời được thẳng từ đoạn này.
     */
    async indexActionItem(
        meeting: KnowledgeMeeting,
        task: Pick<
            ActionItem,
            | "_id"
            | "title"
            | "description"
            | "assigneeId"
            | "deadline"
            | "deadlineRawText"
            | "priority"
            | "status"
        >,
        extra: ReviewExtra = {},
    ) {
        const assignee =
            extra.assigneeName ??
            (await this.userName(task.assigneeId)) ??
            (str(extra.assigneeHint) || undefined);
        const deadline = task.deadline
            ? dayFormat.format(new Date(task.deadline))
            : task.deadlineRawText
              ? `${task.deadlineRawText} (chưa chốt ngày)`
              : "chưa có";
        const lines = [
            task.title,
            str(task.description) || str(extra.description),
            `Người thực hiện: ${assignee ?? "chưa giao"}`,
            `Hạn: ${deadline}`,
            `Ưu tiên: ${PRIORITY_LABEL[task.priority] ?? task.priority}`,
            `Trạng thái: ${TASK_STATUS_LABEL[task.status] ?? task.status}`,
            str(extra.quote) ? `Trích lời: "${str(extra.quote)}"` : "",
        ];
        await this.emit(meeting, "action_item", task._id, [
            { title: task.title, text: lines.filter(Boolean).join("\n") },
        ]);
    }

    /** Tài liệu không gửi nội dung: ai-worker tự tải từ MinIO và tách chữ. */
    async indexDocument(
        meeting: KnowledgeMeeting,
        file: Pick<
            MediaFile,
            "_id" | "bucket" | "objectKey" | "originalName" | "mimetype"
        >,
    ) {
        await this.emit(meeting, "document", file._id, undefined, {
            document: {
                bucket: file.bucket,
                objectKey: file.objectKey,
                fileName: file.originalName || basename(file.objectKey),
                mimetype: file.mimetype,
            },
        });
    }

    async deleteSource(
        workspaceId: string,
        payload: KnowledgeDeleteRequestedPayload,
    ) {
        await this.outboxService.emit({
            aggregateType: payload.sourceType ?? "meeting",
            aggregateId: payload.sourceId ?? payload.meetingId,
            eventType: EventType.KNOWLEDGE_DELETE_REQUESTED,
            workspaceId,
            correlationId: payload.meetingId,
            payload: payload as Record<string, any>,
        });
    }

    async userNames(userIds: (string | null | undefined)[]) {
        const ids = [...new Set(userIds.filter(Boolean))] as string[];
        if (!ids.length) return new Map<string, string>();
        const users = await this.userService.getMany(
            null,
            { _id: { $in: ids } },
            { enableDataPartition: false },
        );
        return new Map(
            users.map(
                (u) => [u._id, u.fullname || u.username] as [string, string],
            ),
        );
    }

    private async userName(userId?: string | null) {
        if (!userId) return undefined;
        return (await this.userNames([userId])).get(userId);
    }

    private async emit(
        meeting: KnowledgeMeeting,
        sourceType: KnowledgeSourceType,
        sourceId: string,
        items: KnowledgeItem[] | undefined,
        extra: Pick<
            KnowledgeIndexRequestedPayload,
            "sourceVersion" | "document"
        > = {},
    ) {
        const payload: KnowledgeIndexRequestedPayload = {
            meetingId: meeting._id,
            projectId: meeting.projectId || undefined,
            meetingTitle: meeting.title,
            meetingDate: meetingDateOf(meeting),
            sourceType,
            sourceId,
            ...extra,
            ...(items ? { items } : {}),
        };
        await this.outboxService.emit({
            aggregateType: sourceType,
            aggregateId: sourceId,
            eventType: EventType.KNOWLEDGE_INDEX_REQUESTED,
            workspaceId: meeting.workspaceId,
            // Lần theo một cuộc họp xuyên Core → AI như các sự kiện khác.
            correlationId: meeting._id,
            payload: payload as unknown as Record<string, any>,
        });
    }
}

/**
 * Biên bản soạn lại trong trình sửa có thể có thêm mục (`sections`). Chưa có
 * định dạng cố định nên đọc mềm: tiêu đề + nội dung dạng chữ, bỏ qua mục rỗng.
 */
function editorSections(content: unknown): KnowledgeItem[] {
    const sections = (content as { sections?: unknown })?.sections;
    if (!Array.isArray(sections)) return [];
    return sections
        .map((s: Record<string, unknown>) => ({
            title: str(s?.title) || str(s?.heading) || undefined,
            text: str(s?.content) || str(s?.body) || str(s?.text),
        }))
        .filter((i) => i.text);
}
