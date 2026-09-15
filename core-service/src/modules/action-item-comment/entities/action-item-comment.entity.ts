import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class ActionItemComment implements BaseEntity {
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
     * Người bình luận
     */
    @IsString()
    @EntityDefinition.field({ label: "Người bình luận", required: true })
    authorId: string;

    /**
     * Nội dung
     */
    @IsString()
    @EntityDefinition.field({ label: "Nội dung", required: true })
    body: string;

    /**
     * Thời điểm xóa mềm
     */
    @IsOptional()
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm xóa mềm" })
    deletedAt?: Date;
}
