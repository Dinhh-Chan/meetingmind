import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import {
    IsDateString,
    IsEnum,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
} from "class-validator";
import { SyncJobStatus, SyncJobType } from "../common/constant";

/**
 * Một lần gọi ra công cụ ngoài. idempotencyKey unique để cùng một việc chỉ có
 * một job; job đã succeeded thì dùng lại kết quả, không gọi API lần nữa.
 */
export class SyncJob implements BaseEntity {
    /**
     * ID
     */
    @IsOptional()
    @IsString()
    _id: string;

    /**
     * ID workspace (tham chiếu logic sang Core)
     */
    @IsString()
    @EntityDefinition.field({ label: "ID workspace", required: true })
    workspaceId: string;

    /**
     * Kết nối dùng để đồng bộ
     */
    @IsString()
    @EntityDefinition.field({ label: "ID kết nối", required: true })
    integrationId: string;

    /**
     * Loại job
     */
    @IsEnum(SyncJobType)
    @EntityDefinition.field({
        label: "Loại job",
        required: true,
        enum: Object.values(SyncJobType),
    })
    type: SyncJobType;

    /**
     * Trạng thái
     */
    @IsEnum(SyncJobStatus)
    @EntityDefinition.field({
        label: "Trạng thái",
        required: true,
        enum: Object.values(SyncJobStatus),
    })
    status: SyncJobStatus;

    /**
     * Khóa chống làm lặp
     */
    @IsString()
    @EntityDefinition.field({ label: "Khóa chống làm lặp", required: true })
    idempotencyKey: string;

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
     * Bắt đầu chạy lúc
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Bắt đầu chạy lúc" })
    startedAt?: Date;

    /**
     * Kết thúc lúc
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Kết thúc lúc" })
    finishedAt?: Date;
}
