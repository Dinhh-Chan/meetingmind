import { TaskSyncRequestedPayload } from "@module/messaging/common/constant";

type Task = TaskSyncRequestedPayload["task"];

/** Hạn hiển thị theo giờ Việt Nam, không phụ thuộc TZ của máy chạy. */
const DISPLAY_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Trello giới hạn mô tả 16384 ký tự; cắt phần tự do để dòng đánh dấu không bị mất. */
const MAX_DESCRIPTION = 8000;
const MAX_QUOTE = 2000;
/** Telegram giới hạn 4096 ký tự một tin. */
const MAX_TELEGRAM_TITLE = 500;

const PRIORITY_LABEL: Record<string, string> = {
    low: "Thấp",
    medium: "Trung bình",
    high: "Cao",
    urgent: "Khẩn cấp",
};

/**
 * Dòng đánh dấu trong mô tả thẻ Trello. Trello không có khóa idempotency, nên
 * trước khi tạo thẻ phải tìm dòng này: lần trước có thể đã tạo xong nhưng mất
 * phản hồi.
 */
export const trelloMarker = (actionItemId: string) =>
    `MeetingMind #${actionItemId}`;

export const hasMarkerLine = (desc: string | undefined, marker: string) =>
    (desc ?? "").split("\n").some((line) => line.trim() === marker);

export const priorityLabel = (priority?: string) =>
    PRIORITY_LABEL[priority?.toLowerCase()] ?? priority ?? "Không rõ";

const truncate = (text: string, max: number) =>
    text.length > max ? `${text.slice(0, max - 1)}…` : text;

/** Hạn đã chốt dạng dd/mm/yyyy; chưa chốt thì giữ câu gốc. */
export function formatDeadline(task: Task): string | undefined {
    const date = parseDeadline(task.deadline);
    if (date) {
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: DISPLAY_TIMEZONE,
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).formatToParts(date);
        const get = (type: string) => parts.find((p) => p.type === type)?.value;
        return `${get("day")}/${get("month")}/${get("year")}`;
    }
    if (task.deadlineRawText) {
        return `${task.deadlineRawText} (chưa chốt ngày)`;
    }
    return undefined;
}

/** Hạn hợp lệ cho trường `due` của Trello, sai định dạng thì bỏ. */
export function parseDeadline(deadline?: string): Date | undefined {
    if (!deadline) {
        return undefined;
    }
    const date = new Date(deadline);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

export function buildTrelloDescription(
    payload: TaskSyncRequestedPayload,
): string {
    const { task } = payload;
    const lines: string[] = [];
    if (task.description) {
        lines.push(truncate(task.description, MAX_DESCRIPTION), "");
    }
    lines.push(
        `**Người thực hiện:** ${task.assigneeName || "Chưa giao"}`,
        `**Hạn:** ${formatDeadline(task) ?? "Chưa có"}`,
        `**Ưu tiên:** ${priorityLabel(task.priority)}`,
        `**Cuộc họp:** ${task.meetingTitle}`,
    );
    if (task.sourceQuote) {
        lines.push(
            "",
            ...truncate(task.sourceQuote, MAX_QUOTE)
                .split("\n")
                .map((line) => `> ${line}`),
        );
    }
    // Dòng trống trước "---" để Markdown hiểu là đường kẻ, không phải tiêu đề.
    lines.push("", "---", trelloMarker(payload.actionItemId));
    return lines.join("\n");
}

export const escapeHtml = (text: string) =>
    text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

/** Tin Telegram (parse_mode HTML). Mọi dữ liệu người dùng đều phải escape. */
export function buildTelegramMessage(
    payload: TaskSyncRequestedPayload,
    trelloUrl?: string,
): string {
    const { task } = payload;
    const lines = [
        "🆕 Công việc mới từ cuộc họp",
        `<b>${escapeHtml(truncate(task.title, MAX_TELEGRAM_TITLE))}</b>`,
        `Người thực hiện: ${escapeHtml(task.assigneeName || "Chưa giao")}`,
        `Hạn: ${escapeHtml(formatDeadline(task) ?? "Chưa có")}`,
        `Ưu tiên: ${escapeHtml(priorityLabel(task.priority))}`,
        `Cuộc họp: ${escapeHtml(task.meetingTitle)}`,
    ];
    if (trelloUrl) {
        lines.push(`<a href="${escapeHtml(trelloUrl)}">Mở thẻ Trello</a>`);
    }
    return lines.join("\n");
}

/**
 * Xoá bí mật khỏi chuỗi. Key/token Trello nằm trên query string, token
 * Telegram nằm trên đường dẫn, nên thông báo lỗi nào cũng phải qua đây trước
 * khi ghi log, ghi DB hay gửi đi.
 */
export function redactSecrets(text: string, secrets: string[]): string {
    let result = text ?? "";
    for (const secret of secrets) {
        if (!secret) {
            continue;
        }
        for (const variant of new Set([secret, encodeURIComponent(secret)])) {
            result = result.split(variant).join("***");
        }
    }
    return result;
}
