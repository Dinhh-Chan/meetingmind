import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString } from "class-validator";
import { OutboxStatus } from "../common/constant";

export class OutboxEvent implements BaseEntity {
    /**
     * ID
     */
    @IsOptional()
    @IsString()
    _id: string;

    /**
     * Loại đối tượng
     */
    @IsString()
    @EntityDefinition.field({ label: "Loại đối tượng", required: true })
    aggregateType: string;

    /**
     * ID đối tượng
     */
    @IsString()
    @EntityDefinition.field({ label: "ID đối tượng", required: true })
    aggregateId: string;

    /**
     * Tên sự kiện
     */
    @IsString()
    @EntityDefinition.field({ label: "Tên sự kiện", required: true })
    eventType: string;

    /**
     * Phiên bản sự kiện
     */
    @IsInt()
    @EntityDefinition.field({ label: "Phiên bản sự kiện", required: true })
    eventVersion: number;

    /**
     * Nội dung sự kiện
     */
    @IsObject()
    @EntityDefinition.field({ label: "Nội dung sự kiện", required: true })
    payload: Record<string, any>;

    /**
     * Trạng thái
     */
    @IsEnum(OutboxStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(OutboxStatus) })
    status: OutboxStatus;

    /**
     * Thời điểm đã phát
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời điểm đã phát" })
    publishedAt?: Date;

    /**
     * Số lần thử lại
     */
    @IsInt()
    @EntityDefinition.field({ label: "Số lần thử lại", required: true })
    retryCount: number;
}
