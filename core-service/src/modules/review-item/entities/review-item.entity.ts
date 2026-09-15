import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsObject, IsOptional, IsString } from "class-validator";
import { ReviewItemStatus, ReviewItemType } from "../common/constant";

export class ReviewItem implements BaseEntity {
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
     * Lô duyệt
     */
    @IsString()
    @EntityDefinition.field({ label: "Lô duyệt", required: true })
    reviewBatchId: string;

    /**
     * Loại
     */
    @IsEnum(ReviewItemType)
    @EntityDefinition.field({ label: "Loại", required: true, enum: Object.values(ReviewItemType) })
    type: ReviewItemType;

    /**
     * Nội dung AI sinh ra ban đầu
     */
    @IsObject()
    @EntityDefinition.field({ label: "Nội dung AI sinh ra ban đầu", required: true })
    originalPayload: Record<string, any>;

    /**
     * Nội dung hiện tại sau khi sửa
     */
    @IsObject()
    @EntityDefinition.field({ label: "Nội dung hiện tại sau khi sửa", required: true })
    payload: Record<string, any>;

    /**
     * Trạng thái
     */
    @IsEnum(ReviewItemStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(ReviewItemStatus) })
    status: ReviewItemStatus;

    /**
     * Người sửa
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người sửa" })
    editedById?: string;

    /**
     * Thời điểm sửa
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời điểm sửa" })
    editedAt?: Date;

    /**
     * Lý do loại
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Lý do loại" })
    rejectReason?: string;

    /**
     * Công việc sinh ra khi duyệt
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Công việc sinh ra khi duyệt" })
    actionItemId?: string;

    /**
     * Quyết định sinh ra khi duyệt
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Quyết định sinh ra khi duyệt" })
    decisionId?: string;
}
