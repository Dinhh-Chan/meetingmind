import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class ProcessedMessage implements BaseEntity {
    /**
     * ID
     */
    @IsOptional()
    @IsString()
    _id: string;

    /**
     * ID message
     */
    @IsString()
    @EntityDefinition.field({ label: "ID message", required: true })
    messageId: string;

    /**
     * Tên handler đã xử lý
     */
    @IsString()
    @EntityDefinition.field({ label: "Tên handler đã xử lý", required: true })
    consumer: string;

    /**
     * Thời điểm xử lý
     */
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm xử lý", required: true })
    processedAt: Date;
}
