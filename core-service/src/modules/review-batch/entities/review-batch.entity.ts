import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { ReviewBatchStatus } from "../common/constant";

export class ReviewBatch implements BaseEntity {
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
     * Trạng thái
     */
    @IsEnum(ReviewBatchStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(ReviewBatchStatus) })
    status: ReviewBatchStatus;

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
    reviewerId?: string;

    /**
     * Thời điểm duyệt
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời điểm duyệt" })
    reviewedAt?: Date;
}
