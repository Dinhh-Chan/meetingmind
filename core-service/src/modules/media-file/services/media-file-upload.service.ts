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

        const bucket = this.minioService.getBucket();
        const checksum = createHash("sha256").update(input.buffer).digest("hex");

        // Cùng nội dung tải lại thì dùng lại bản ghi cũ, không tạo file trùng
        // trên MinIO.
        const existing = await this.mediaFileService.getOne(null, {
            workspaceId: input.workspaceId,
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
