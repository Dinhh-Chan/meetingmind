import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsOptional, IsString } from "class-validator";

export class TaskDependency implements BaseEntity {
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
     * Công việc bị chặn
     */
    @IsString()
    @EntityDefinition.field({ label: "Công việc bị chặn", required: true })
    actionItemId: string;

    /**
     * Công việc phải xong trước
     */
    @IsString()
    @EntityDefinition.field({ label: "Công việc phải xong trước", required: true })
    dependsOnActionItemId: string;

    /**
     * Ghi chú
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Ghi chú" })
    note?: string;
}
