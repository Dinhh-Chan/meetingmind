import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { WorkspaceMemberRole, WorkspaceMemberStatus } from "../common/constant";

export class WorkspaceMember implements BaseEntity {
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
     * Người dùng
     */
    @IsString()
    @EntityDefinition.field({ label: "Người dùng", required: true })
    userId: string;

    /**
     * Vai trò
     */
    @IsEnum(WorkspaceMemberRole)
    @EntityDefinition.field({ label: "Vai trò", required: true, enum: Object.values(WorkspaceMemberRole) })
    role: WorkspaceMemberRole;

    /**
     * Trạng thái
     */
    @IsEnum(WorkspaceMemberStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(WorkspaceMemberStatus) })
    status: WorkspaceMemberStatus;

    /**
     * Thời điểm tham gia
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời điểm tham gia" })
    joinedAt?: Date;
}
