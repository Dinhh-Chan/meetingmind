import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { DecisionSource, DecisionStatus } from "../common/constant";

export class Decision implements BaseEntity {
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
     * Mục agenda
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Mục agenda" })
    agendaItemId?: string;

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
     * Người quyết định
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người quyết định" })
    decidedById?: string;

    /**
     * Trạng thái
     */
    @IsEnum(DecisionStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(DecisionStatus) })
    status: DecisionStatus;

    /**
     * Bị thay thế bởi quyết định
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Bị thay thế bởi quyết định" })
    supersededByDecisionId?: string;

    /**
     * Nguồn
     */
    @IsEnum(DecisionSource)
    @EntityDefinition.field({ label: "Nguồn", required: true, enum: Object.values(DecisionSource) })
    source: DecisionSource;

    /**
     * Mục duyệt đã sinh ra quyết định này
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Mục duyệt đã sinh ra quyết định này" })
    reviewItemId?: string;

    /**
     * Thời điểm xóa mềm
     */
    @IsOptional()
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm xóa mềm" })
    deletedAt?: Date;
}
