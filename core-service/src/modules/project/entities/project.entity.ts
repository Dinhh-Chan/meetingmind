import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { ProjectStatus } from "../common/constant";

export class Project implements BaseEntity {
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
     * Tên dự án
     */
    @IsString()
    @EntityDefinition.field({ label: "Tên dự án", required: true })
    name: string;

    /**
     * Mô tả
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Mô tả" })
    description?: string;

    /**
     * Trạng thái
     */
    @IsEnum(ProjectStatus)
    @EntityDefinition.field({ label: "Trạng thái", required: true, enum: Object.values(ProjectStatus) })
    status: ProjectStatus;

    /**
     * Người tạo
     */
    @IsString()
    @EntityDefinition.field({ label: "Người tạo", required: true })
    createdById: string;

    /**
     * Thời điểm xóa mềm
     */
    @IsOptional()
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm xóa mềm" })
    deletedAt?: Date;
}
