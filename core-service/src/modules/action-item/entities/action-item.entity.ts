import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { ActionItemPriority, ActionItemSource, ActionItemStatus } from "../common/constant";

export class ActionItem implements BaseEntity {
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
     * Mục duyệt đã sinh ra task này
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Mục duyệt đã sinh ra task này" })
    reviewItemId?: string;

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
     * Người đề xuất / giao việc
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người đề xuất / giao việc" })
    proposerId?: string;

    /**
     * Người thực hiện
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người thực hiện" })
    assigneeId?: string;

    /**
     * Người duyệt kết quả
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người duyệt kết quả" })
    approverId?: string;

    /**
     * Hạn hoàn thành
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Hạn hoàn thành" })
    deadline?: Date;

    /**
     * Câu gốc nói về hạn (ví dụ: thứ Sáu)
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Câu gốc nói về hạn (ví dụ: thứ Sáu)" })
    deadlineRawText?: string;

    /**
     * Hạn cần xác nhận lại
     */
    @IsBoolean()
    @EntityDefinition.field({ label: "Hạn cần xác nhận lại", required: true })
    deadlineNeedsConfirm: boolean;

    /**
     * Độ ưu tiên
     */
    @IsEnum(ActionItemPriority)
    @EntityDefinition.field({ label: "Độ ưu tiên", required: true, enum: Object.values(ActionItemPriority) })
    priority: ActionItemPriority;

    /**
     * Trạng thái
     */
    @IsEnum(ActionItemStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(ActionItemStatus) })
    status: ActionItemStatus;

    /**
     * Điều kiện hoàn thành
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Điều kiện hoàn thành" })
    definitionOfDone?: string;

    /**
     * Nguồn
     */
    @IsEnum(ActionItemSource)
    @EntityDefinition.field({ label: "Nguồn", required: true, enum: Object.values(ActionItemSource) })
    source: ActionItemSource;

    /**
     * Độ tin cậy nếu do AI sinh
     */
    @IsNumber()
    @IsOptional()
    @EntityDefinition.field({ label: "Độ tin cậy nếu do AI sinh" })
    confidence?: number;

    /**
     * Lý do cần rà soát lại
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Lý do cần rà soát lại" })
    needsReviewReason?: string;

    /**
     * Người tạo
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người tạo" })
    createdById?: string;

    /**
     * Thời điểm xóa mềm
     */
    @IsOptional()
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm xóa mềm" })
    deletedAt?: Date;
}
