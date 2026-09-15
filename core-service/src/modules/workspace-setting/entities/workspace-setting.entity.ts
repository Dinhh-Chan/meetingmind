import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsBoolean, IsInt, IsObject, IsOptional, IsString } from "class-validator";

export class WorkspaceSetting implements BaseEntity {
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
     * Mẫu biên bản
     */
    @IsObject()
    @IsOptional()
    @EntityDefinition.field({ label: "Mẫu biên bản" })
    minutesTemplate?: Record<string, any>;

    /**
     * Quy tắc nhắc deadline
     */
    @IsObject()
    @IsOptional()
    @EntityDefinition.field({ label: "Quy tắc nhắc deadline" })
    reminderRules?: Record<string, any>;

    /**
     * Số ngày lưu audio
     */
    @IsInt()
    @EntityDefinition.field({ label: "Số ngày lưu audio", required: true })
    audioRetentionDays: number;

    /**
     * Số ngày lưu transcript
     */
    @IsInt()
    @IsOptional()
    @EntityDefinition.field({ label: "Số ngày lưu transcript" })
    transcriptRetentionDays?: number;

    /**
     * Tự động tham gia họp
     */
    @IsBoolean()
    @EntityDefinition.field({ label: "Tự động tham gia họp", required: true })
    autoJoinEnabled: boolean;

    /**
     * Tự động đồng bộ task đã duyệt
     */
    @IsBoolean()
    @EntityDefinition.field({ label: "Tự động đồng bộ task đã duyệt", required: true })
    autoSyncEnabled: boolean;
}
