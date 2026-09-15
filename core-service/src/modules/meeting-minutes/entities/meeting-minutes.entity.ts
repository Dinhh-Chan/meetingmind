import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsArray, IsDateString, IsEnum, IsObject, IsOptional, IsString } from "class-validator";
import { MinutesStatus } from "../common/constant";

export class MeetingMinutes implements BaseEntity {
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
     * Tóm tắt
     */
    @IsString()
    @EntityDefinition.field({ label: "Tóm tắt", required: true })
    summary: string;

    /**
     * Danh sách quyết định
     */
    @IsArray()
    @EntityDefinition.field({ label: "Danh sách quyết định", required: true })
    decisions: Record<string, any>[];

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
     * Trạng thái
     */
    @IsEnum(MinutesStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(MinutesStatus) })
    status: MinutesStatus;

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
