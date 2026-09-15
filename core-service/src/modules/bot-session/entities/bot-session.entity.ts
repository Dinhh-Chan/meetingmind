import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { BotSessionStatus } from "../common/constant";

export class BotSession implements BaseEntity {
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
    @IsEnum(BotSessionStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(BotSessionStatus) })
    status: BotSessionStatus;

    /**
     * Link vào phòng
     */
    @IsString()
    @EntityDefinition.field({ label: "Link vào phòng", required: true })
    joinUrl: string;

    /**
     * Lần thử thứ mấy
     */
    @IsInt()
    @EntityDefinition.field({ label: "Lần thử thứ mấy", required: true })
    attempt: number;

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
    endedAt?: Date;

    /**
     * Nhịp sống, dùng phát hiện session treo
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Nhịp sống, dùng phát hiện session treo" })
    heartbeatAt?: Date;

    /**
     * Lỗi
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Lỗi" })
    error?: string;
}
