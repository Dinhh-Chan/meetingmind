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
     * Là phiên bản đang dùng
     */
    @IsBoolean()
    @EntityDefinition.field({ label: "Là phiên bản đang dùng", required: true })
    isCurrent: boolean;
}
