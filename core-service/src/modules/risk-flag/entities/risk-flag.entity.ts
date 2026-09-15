import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsObject, IsOptional, IsString } from "class-validator";
import { RiskSeverity, RiskStatus, RiskType } from "../common/constant";

export class RiskFlag implements BaseEntity {
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
     * Cuộc họp
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Cuộc họp" })
    meetingId?: string;

    /**
     * Người bị ảnh hưởng
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người bị ảnh hưởng" })
    userId?: string;

    /**
     * Công việc liên quan
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Công việc liên quan" })
    actionItemId?: string;

    /**
     * Loại rủi ro
     */
    @IsEnum(RiskType)
    @EntityDefinition.field({ label: "Loại rủi ro", required: true, enum: Object.values(RiskType) })
    type: RiskType;

    /**
     * Mức độ
     */
    @IsEnum(RiskSeverity)
    @EntityDefinition.field({ label: "Mức độ", required: true, enum: Object.values(RiskSeverity) })
    severity: RiskSeverity;

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
     * Quy tắc tạo ra cảnh báo
     */
    @IsString()
    @EntityDefinition.field({ label: "Quy tắc tạo ra cảnh báo", required: true })
    ruleKey: string;

    /**
     * Dữ liệu dùng để kết luận
     */
    @IsObject()
    @EntityDefinition.field({ label: "Dữ liệu dùng để kết luận", required: true })
    evidence: Record<string, any>;

    /**
     * Khóa chống tạo lặp
     */
    @IsString()
    @EntityDefinition.field({ label: "Khóa chống tạo lặp", required: true })
    dedupKey: string;

    /**
     * Trạng thái
     */
    @IsEnum(RiskStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(RiskStatus) })
    status: RiskStatus;

    /**
     * Thời điểm phát hiện
     */
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm phát hiện", required: true })
    detectedAt: Date;

    /**
     * Thời điểm xử lý xong
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời điểm xử lý xong" })
    resolvedAt?: Date;
}
