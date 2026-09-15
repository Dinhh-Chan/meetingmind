import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { WorkspacePlan } from "../common/constant";

export class Workspace implements BaseEntity {
    /**
     * ID
     */
    @IsOptional()
    @IsString()
    _id: string;

    /**
     * Tên workspace
     */
    @IsString()
    @EntityDefinition.field({ label: "Tên workspace", required: true })
    name: string;

    /**
     * Slug
     */
    @IsString()
    @EntityDefinition.field({ label: "Slug", required: true })
    slug: string;

    /**
     * Chủ sở hữu
     */
    @IsString()
    @EntityDefinition.field({ label: "Chủ sở hữu", required: true })
    ownerId: string;

    /**
     * Gói dịch vụ
     */
    @IsEnum(WorkspacePlan)
    @EntityDefinition.field({ label: "Gói dịch vụ", required: true, enum: Object.values(WorkspacePlan) })
    plan: WorkspacePlan;

    /**
     * Múi giờ
     */
    @IsString()
    @EntityDefinition.field({ label: "Múi giờ", required: true })
    timezone: string;

    /**
     * Thời điểm xóa mềm
     */
    @IsOptional()
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm xóa mềm" })
    deletedAt?: Date;
}
