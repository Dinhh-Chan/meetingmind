import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { ActivityType } from "../common/constant";

/** Một thay đổi nghiệp vụ trong workspace: ai làm gì, trên đối tượng nào. */
export class ActivityLog implements BaseEntity {
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
     * Người thực hiện; trống là hệ thống
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người thực hiện" })
    actorId?: string;

    /**
     * Loại thay đổi
     */
    @IsEnum(ActivityType)
    @EntityDefinition.field({ label: "Loại thay đổi", required: true, enum: Object.values(ActivityType) })
    type: ActivityType;

    /**
     * Đối tượng, viết sẵn để hiển thị (VD "Phúc → Member · Web bán hàng")
     */
    @IsString()
    @EntityDefinition.field({ label: "Đối tượng", required: true })
    target: string;

    /**
     * Cuộc họp liên quan
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Cuộc họp" })
    meetingId?: string;

    /**
     * Dự án liên quan
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Dự án" })
    projectId?: string;
}
