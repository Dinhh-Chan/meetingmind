import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsArray, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString } from "class-validator";
import { MinutesVersionStatus } from "../common/constant";

export class MinutesVersion implements BaseEntity {
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
     * Biên bản
     */
    @IsString()
    @EntityDefinition.field({ label: "Biên bản", required: true })
    meetingMinutesId: string;

    /**
     * Số phiên bản
     */
    @IsInt()
    @EntityDefinition.field({ label: "Số phiên bản", required: true })
    versionNo: number;

    /**
     * Tóm tắt
     */
    @IsString()
    @EntityDefinition.field({ label: "Tóm tắt", required: true })
    summary: string;

    /**
     * Vấn đề tồn đọng
     */
    @IsArray()
    @EntityDefinition.field({ label: "Vấn đề tồn đọng", required: true })
    openIssues: Record<string, any>[];

    /**
     * Nội dung editor
     */
    @IsObject()
    @IsOptional()
    @EntityDefinition.field({ label: "Nội dung editor" })
    editorContent?: Record<string, any>;

    /**
     * Mẫu biên bản đã dùng
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Mẫu biên bản đã dùng" })
    templateKey?: string;

    /**
     * Trạng thái
     */
    @IsEnum(MinutesVersionStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(MinutesVersionStatus) })
    status: MinutesVersionStatus;

    /**
     * Phiên bản transcript làm đầu vào
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Phiên bản transcript làm đầu vào" })
    sourceTranscriptVersionId?: string;

    /**
     * Lần chạy AI
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Lần chạy AI" })
    aiRunId?: string;

    /**
     * Người duyệt
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người duyệt" })
    approvedById?: string;

    /**
     * Thời điểm duyệt
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời điểm duyệt" })
    approvedAt?: Date;
}
