import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { TranscriptVersionSource } from "../common/constant";

export class TranscriptVersion implements BaseEntity {
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
     * Số phiên bản
     */
    @IsInt()
    @EntityDefinition.field({ label: "Số phiên bản", required: true })
    versionNo: number;

    /**
     * Nguồn tạo
     */
    @IsEnum(TranscriptVersionSource)
    @EntityDefinition.field({ label: "Nguồn tạo", required: true, enum: Object.values(TranscriptVersionSource) })
    source: TranscriptVersionSource;

    /**
     * Lần chạy AI
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Lần chạy AI" })
    aiRunId?: string;

    /**
     * Người sửa
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người sửa" })
    createdById?: string;

    /**
     * Người ghi âm: mỗi người ghi có transcript riêng, chỉ người đó (và người
     * duyệt) xem được cho tới khi biên bản từ bản ghi đó được duyệt.
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người ghi âm" })
    recordedById?: string;

    /**
     * Tệp ghi âm nguồn (objectKey): mỗi lần ghi âm là một bản ghi riêng của
     * người ghi ("Bản ghi 1, 2…"), bản mới không thay bản cũ.
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Tệp ghi âm nguồn" })
    recordingKey?: string;

    /**
     * Là phiên bản đang dùng (của bản ghi âm đó)
     */
    @IsBoolean()
    @EntityDefinition.field({ label: "Là phiên bản đang dùng", required: true })
    isCurrent: boolean;
}
