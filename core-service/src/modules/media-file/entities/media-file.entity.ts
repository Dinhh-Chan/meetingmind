import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { MediaFileKind, MediaFileStatus } from "../common/constant";

export class MediaFile implements BaseEntity {
    /**
     * ID
     */
    @IsOptional()
    @IsString()
    _id: string;

    /**
     * Workspace
     */
    @IsString()
    @EntityDefinition.field({ label: "Workspace", required: true })
    workspaceId: string;

    /**
     * Cuộc họp
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Cuộc họp" })
    meetingId?: string;

    /**
     * Phiên bot
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Phiên bot" })
    botSessionId?: string;

    /**
     * Loại file
     */
    @IsEnum(MediaFileKind)
    @EntityDefinition.field({ label: "Loại file", required: true, enum: Object.values(MediaFileKind) })
    kind: MediaFileKind;

    /**
     * Bucket
     */
    @IsString()
    @EntityDefinition.field({ label: "Bucket", required: true })
    bucket: string;

    /**
     * Object key trong MinIO
     */
    @IsString()
    @EntityDefinition.field({ label: "Object key trong MinIO", required: true })
    objectKey: string;

    /**
     * MIME type
     */
    @IsString()
    @EntityDefinition.field({ label: "MIME type", required: true })
    mimetype: string;

    /**
     * Kích thước (byte)
     */
    @IsInt()
    @EntityDefinition.field({ label: "Kích thước (byte)", required: true })
    sizeBytes: number;

    /**
     * Thời lượng (ms), với audio
     */
    @IsInt()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời lượng (ms), với audio" })
    durationMs?: number;

    /**
     * sha256, dùng chống trùng
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "sha256, dùng chống trùng" })
    checksum?: string;

    /**
     * Trạng thái
     */
    @IsEnum(MediaFileStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(MediaFileStatus) })
    status: MediaFileStatus;

    /**
     * Người tải lên
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người tải lên" })
    uploadedById?: string;

    /**
     * Thời điểm xóa mềm
     */
    @IsOptional()
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm xóa mềm" })
    deletedAt?: Date;
}
