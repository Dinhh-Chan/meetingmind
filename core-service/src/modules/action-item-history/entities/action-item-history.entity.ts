import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsObject, IsOptional, IsString } from "class-validator";

export class ActionItemHistory implements BaseEntity {
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
     * Công việc
     */
    @IsString()
    @EntityDefinition.field({ label: "Công việc", required: true })
    actionItemId: string;

    /**
     * Người thao tác
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người thao tác" })
    actorId?: string;

    /**
     * Trường thay đổi
     */
    @IsString()
    @EntityDefinition.field({ label: "Trường thay đổi", required: true })
    field: string;

    /**
     * Giá trị cũ
     */
    @IsObject()
    @IsOptional()
    @EntityDefinition.field({ label: "Giá trị cũ" })
    oldValue?: Record<string, any>;

    /**
     * Giá trị mới
     */
    @IsObject()
    @IsOptional()
    @EntityDefinition.field({ label: "Giá trị mới" })
    newValue?: Record<string, any>;
}
