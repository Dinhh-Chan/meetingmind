import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { ProjectDiscipline, ProjectMemberRole } from "../common/constant";

export class ProjectMember implements BaseEntity {
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
     * Dự án
     */
    @IsString()
    @EntityDefinition.field({ label: "Dự án", required: true })
    projectId: string;

    /**
     * Người dùng
     */
    @IsString()
    @EntityDefinition.field({ label: "Người dùng", required: true })
    userId: string;

    /**
     * Quyền trong dự án
     */
    @IsEnum(ProjectMemberRole)
    @EntityDefinition.field({ label: "Quyền trong dự án", required: true, enum: Object.values(ProjectMemberRole) })
    role: ProjectMemberRole;

    /**
     * Vai trò chuyên môn
     */
    @IsEnum(ProjectDiscipline)
    @IsOptional()
    @EntityDefinition.field({ label: "Vai trò chuyên môn", enum: Object.values(ProjectDiscipline) })
    discipline?: ProjectDiscipline;
}
