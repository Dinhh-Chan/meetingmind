import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class UserSession implements BaseEntity {
    /**
     * ID
     */
    @IsOptional()
    @IsString()
    _id: string;

    /**
     * Người dùng
     */
    @IsString()
    @EntityDefinition.field({ label: "Người dùng", required: true })
    userId: string;

    /**
     * Hash của refresh token
     */
    @IsString()
    @EntityDefinition.field({ label: "Hash của refresh token", required: true })
    refreshTokenHash: string;

    /**
     * User agent
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "User agent" })
    userAgent?: string;

    /**
     * Địa chỉ IP
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Địa chỉ IP" })
    ipAddress?: string;

    /**
     * Thời điểm hết hạn
     */
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm hết hạn", required: true })
    expiresAt: Date;

    /**
     * Thời điểm thu hồi
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời điểm thu hồi" })
    revokedAt?: Date;
}
