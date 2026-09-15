import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { UploadSessionStatus } from "../common/constant";

export class UploadSession implements BaseEntity {
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
    @EntityDefinition.field({ label: "Cuộc họp", required: true })
    meetingId: string;

    /**
     * File sinh ra khi hoàn tất
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "File sinh ra khi hoàn tất" })
    fileId?: string;

    /**
     * Multipart upload ID của MinIO
     */
    @IsString()
    @EntityDefinition.field({ label: "Multipart upload ID của MinIO", required: true })
    uploadId: string;

    /**
     * Tổng số phần
     */
    @IsInt()
    @IsOptional()
    @EntityDefinition.field({ label: "Tổng số phần" })
    totalParts?: number;

    /**
     * Các phần đã tải xong
     */
    @IsArray()
    @EntityDefinition.field({ label: "Các phần đã tải xong", required: true })
    completedParts: Record<string, any>[];

    /**
     * ID sinh ở thiết bị, chống trùng khi tải lại
     */
    @IsString()
    @EntityDefinition.field({ label: "ID sinh ở thiết bị, chống trùng khi tải lại", required: true })
    clientRecordingId: string;

    /**
     * Trạng thái
     */
    @IsEnum(UploadSessionStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(UploadSessionStatus) })
    status: UploadSessionStatus;

    /**
     * Thời điểm hết hạn
     */
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm hết hạn", required: true })
    expiresAt: Date;
}
