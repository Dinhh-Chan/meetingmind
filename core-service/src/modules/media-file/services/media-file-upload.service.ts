import { ApiError } from "@config/exception/api-error";
import { MinioService } from "@module/minio/minio.service";
import { Injectable, Logger } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { extname } from "path";
import { MediaFileKind, MediaFileStatus } from "../common/constant";
import { MediaFileService } from "./media-file.service";

const AUDIO_MIME = [
    "audio/mpeg",
    "audio/mp4",
    "audio/x-m4a",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
    "audio/ogg",
    "video/mp4",
    "video/webm",
];

/**
 * Tài liệu cho kho tri thức, theo đuôi tệp. Trình duyệt gửi MIME của .md rất
 * lộn xộn (text/markdown, text/x-markdown, application/octet-stream, rỗng) nên
 * xét đuôi rồi ghi MIME chuẩn, để ai-worker chọn đúng cách tách chữ.
 */
export const DOCUMENT_MIME_BY_EXT: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
    ".md": "text/markdown",
};

/** Tài liệu tri thức tối đa 20 MB: đủ cho đặc tả, biên bản dài; PDF scan lớn hơn thì tách. */
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

export interface UploadInput {
    workspaceId: string;
    meetingId?: string;
    kind?: MediaFileKind;
    originalName: string;
    mimetype: string;
    buffer: Buffer;
    uploadedById?: string;
    durationMs?: number;
    botSessionId?: string;
}

/**
 * Multer giải tên tệp multipart theo latin1 nên tên tiếng Việt bị vỡ dấu.
 * Đọc lại các byte đó theo UTF-8; tên đã có ký tự ngoài latin1 thì để nguyên.
 */
export function decodeUploadName(name: string): string {
    if (!name || /[^\u0000-\u00ff]/.test(name)) return name;
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    return decoded.includes("\uFFFD") ? name : decoded;
}

/**
 * Đưa file lên MinIO rồi ghi bản ghi `files`.
 *
 * Bảng `files` chỉ giữ bucket và object key — không giữ nội dung và không giữ
 * URL ký tạm. URL chỉ cấp lúc người dùng đã qua kiểm tra quyền.
 */
@Injectable()
export class MediaFileUploadService {
    private readonly logger = new Logger(MediaFileUploadService.name);

    constructor(
        private readonly minioService: MinioService,
        private readonly mediaFileService: MediaFileService,
    ) {}

    async upload(input: UploadInput) {
        const kind = input.kind || MediaFileKind.AUDIO;
        if (kind === MediaFileKind.AUDIO && !AUDIO_MIME.includes(input.mimetype)) {
            throw ApiError.BadRequest("error-mimetype-invalid");
        }
        if (kind === MediaFileKind.DOCUMENT) {
            const mime =
                DOCUMENT_MIME_BY_EXT[extname(input.originalName).toLowerCase()];
            if (!mime) throw ApiError.BadRequest("error-document-invalid");
            if (input.buffer.length > DOCUMENT_MAX_BYTES) {
                throw ApiError.BadRequest("error-document-too-large");
            }
            input = { ...input, mimetype: mime };
        }

        const bucket = this.minioService.getBucket();
        const checksum = createHash("sha256").update(input.buffer).digest("hex");

        // Cùng nội dung tải lại cho cùng cuộc họp thì dùng lại bản ghi cũ, không
        // tạo file trùng trên MinIO. Khác cuộc họp thì lưu riêng: bản ghi tệp
        // gắn với cuộc họp (quyền, lịch sử), và object key là duy nhất.
        const existing = await this.mediaFileService.getOne(null, {
            workspaceId: input.workspaceId,
            meetingId: input.meetingId ?? null,
            kind,
            checksum,
            status: MediaFileStatus.READY,
        });
        if (existing) {
            this.logger.log(`File trùng nội dung, dùng lại ${existing._id}`);
            return existing;
        }

        const ext = extname(input.originalName) || "";
        const objectKey = [
            input.workspaceId,
            input.meetingId || "unassigned",
            `${randomUUID()}${ext}`,
        ].join("/");

        const file = await this.mediaFileService.create(null, {
            workspaceId: input.workspaceId,
            meetingId: input.meetingId,
            botSessionId: input.botSessionId,
            kind,
            bucket,
            objectKey,
            originalName: input.originalName,
            mimetype: input.mimetype,
            sizeBytes: input.buffer.length,
            durationMs: input.durationMs,
            checksum,
            status: MediaFileStatus.UPLOADING,
            uploadedById: input.uploadedById,
        });

        try {
            await this.minioService.putObject(
                objectKey,
                input.buffer,
                input.buffer.length,
                input.mimetype,
            );
        } catch (err) {
            await this.mediaFileService.updateById(null, file._id, {
                status: MediaFileStatus.FAILED,
            });
            this.logger.error(`Đẩy lên MinIO lỗi: ${err.message}`);
            throw err;
        }

        return this.mediaFileService.updateById(null, file._id, {
            status: MediaFileStatus.READY,
        });
    }

    /** Ghi nhận file do bot tự đẩy thẳng lên MinIO (Core không làm trung gian). */
    async registerExisting(input: {
        workspaceId: string;
        meetingId: string;
        botSessionId?: string;
        bucket: string;
        objectKey: string;
        durationMs?: number;
    }) {
        const stat = await this.minioService.statObject(
            input.objectKey,
            input.bucket,
        );
        const existing = await this.mediaFileService.getOne(null, {
            bucket: input.bucket,
            objectKey: input.objectKey,
        });
        if (existing) {
            return existing;
        }
        return this.mediaFileService.create(null, {
            workspaceId: input.workspaceId,
            meetingId: input.meetingId,
            botSessionId: input.botSessionId,
            kind: MediaFileKind.AUDIO,
            bucket: input.bucket,
            objectKey: input.objectKey,
            mimetype: (stat.metaData?.["content-type"] as string) || "audio/ogg",
            sizeBytes: stat.size,
            durationMs: input.durationMs,
            status: MediaFileStatus.READY,
        });
    }

    async getDownloadUrl(fileId: string) {
        const file = await this.mediaFileService.getById(null, fileId);
        return {
            url: await this.minioService.getDownloadUrl(
                file.objectKey,
                file.bucket,
            ),
            expiresInSeconds: 300,
        };
    }
}
