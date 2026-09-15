import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsBoolean, IsDateString, IsEnum, IsObject, IsOptional, IsString } from "class-validator";
import { ConsentMethod } from "../common/constant";

export class RecordingConsent implements BaseEntity {
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
     * Người tham dự
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người tham dự" })
    participantId?: string;

    /**
     * Hình thức thông báo
     */
    @IsEnum(ConsentMethod)
    @EntityDefinition.field({ label: "Hình thức thông báo", required: true, enum: Object.values(ConsentMethod) })
    method: ConsentMethod;

    /**
     * Đã đồng ý
     */
    @IsBoolean()
    @EntityDefinition.field({ label: "Đã đồng ý", required: true })
    granted: boolean;

    /**
     * Thời điểm thông báo
     */
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm thông báo", required: true })
    notifiedAt: Date;

    /**
     * Bằng chứng thông báo
     */
    @IsObject()
    @IsOptional()
    @EntityDefinition.field({ label: "Bằng chứng thông báo" })
    evidence?: Record<string, any>;
}
