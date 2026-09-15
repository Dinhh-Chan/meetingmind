import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { MeetingAccessScope, MeetingPlatform, MeetingSourceType, MeetingStatus, ProcessingStatus } from "../common/constant";

export class Meeting implements BaseEntity {
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
     * Dự án
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Dự án" })
    projectId?: string;

    /**
     * Tiêu đề
     */
    @IsString()
    @EntityDefinition.field({ label: "Tiêu đề", required: true })
    title: string;

    /**
     * Mô tả
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Mô tả" })
    description?: string;

    /**
     * Nguồn cuộc họp
     */
    @IsEnum(MeetingSourceType)
    @EntityDefinition.field({ label: "Nguồn cuộc họp", required: true, enum: Object.values(MeetingSourceType) })
    sourceType: MeetingSourceType;

    /**
     * Link phòng họp (chỉ với nguồn meeting_link)
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Link phòng họp (chỉ với nguồn meeting_link)" })
    meetingUrl?: string;

    /**
     * Nền tảng
     */
    @IsEnum(MeetingPlatform)
    @IsOptional()
    @EntityDefinition.field({ label: "Nền tảng", enum: Object.values(MeetingPlatform) })
    platform?: MeetingPlatform;

    /**
     * Ngôn ngữ
     */
    @IsString()
    @EntityDefinition.field({ label: "Ngôn ngữ", required: true })
    language: string;

    /**
     * Phạm vi truy cập
     */
    @IsEnum(MeetingAccessScope)
    @EntityDefinition.field({ label: "Phạm vi truy cập", required: true, enum: Object.values(MeetingAccessScope) })
    accessScope: MeetingAccessScope;

    /**
     * Trạng thái
     */
    @IsEnum(MeetingStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(MeetingStatus) })
    status: MeetingStatus;

    /**
     * Thời gian bắt đầu dự kiến
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời gian bắt đầu dự kiến" })
    scheduledStartAt?: Date;

    /**
     * Thời gian kết thúc dự kiến
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời gian kết thúc dự kiến" })
    scheduledEndAt?: Date;

    /**
     * Thời gian bắt đầu thực tế
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời gian bắt đầu thực tế" })
    actualStartAt?: Date;

    /**
     * Thời gian kết thúc thực tế
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời gian kết thúc thực tế" })
    actualEndAt?: Date;

    /**
     * Trạng thái xử lý (tổng hợp)
     */
    @IsEnum(ProcessingStatus)
    @IsOptional()
    @EntityDefinition.field({ label: "Trạng thái xử lý (tổng hợp)", enum: Object.values(ProcessingStatus) })
    processingStatus?: ProcessingStatus;

    /**
     * Người tạo
     */
    @IsString()
    @EntityDefinition.field({ label: "Người tạo", required: true })
    createdById: string;

    /**
     * Thời điểm xóa mềm
     */
    @IsOptional()
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm xóa mềm" })
    deletedAt?: Date;
}
