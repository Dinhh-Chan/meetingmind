import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString } from "class-validator";
import { ProcessingJobStatus, ProcessingJobType } from "../common/constant";

export class ProcessingJob implements BaseEntity {
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
    @IsOptional()
    @EntityDefinition.field({ label: "Cuộc họp" })
    meetingId?: string;

    /**
     * Loại job
     */
    @IsEnum(ProcessingJobType)
    @EntityDefinition.field({ label: "Loại job", required: true, enum: Object.values(ProcessingJobType) })
    type: ProcessingJobType;

    /**
     * Trạng thái
     */
    @IsEnum(ProcessingJobStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(ProcessingJobStatus) })
    status: ProcessingJobStatus;

    /**
     * Khóa chống chạy trùng
     */
    @IsString()
    @EntityDefinition.field({ label: "Khóa chống chạy trùng", required: true })
    idempotencyKey: string;

    /**
     * Phiên bản đầu vào
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Phiên bản đầu vào" })
    inputVersion?: string;

    /**
     * Dữ liệu đầu vào
     */
    @IsObject()
    @EntityDefinition.field({ label: "Dữ liệu đầu vào", required: true })
    payload: Record<string, any>;

    /**
     * Kết quả
     */
    @IsObject()
    @IsOptional()
    @EntityDefinition.field({ label: "Kết quả" })
    result?: Record<string, any>;

    /**
     * Lỗi
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Lỗi" })
    error?: string;

    /**
     * Số lần thử lại
     */
    @IsInt()
    @EntityDefinition.field({ label: "Số lần thử lại", required: true })
    retryCount: number;

    /**
     * Lần thử lại kế tiếp
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Lần thử lại kế tiếp" })
    nextRetryAt?: Date;

    /**
     * Bắt đầu
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Bắt đầu" })
    startedAt?: Date;

    /**
     * Kết thúc
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Kết thúc" })
    finishedAt?: Date;

    /**
     * Nhịp sống, dùng phát hiện job treo
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Nhịp sống, dùng phát hiện job treo" })
    heartbeatAt?: Date;
}
