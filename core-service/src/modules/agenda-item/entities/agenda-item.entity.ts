import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsInt, IsOptional, IsString } from "class-validator";

export class AgendaItem implements BaseEntity {
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
     * Tiêu đề
     */
    @IsString()
    @EntityDefinition.field({ label: "Tiêu đề", required: true })
    title: string;

    /**
     * Mô tả
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Mô tả" })
    description?: string;

    /**
     * Thứ tự
     */
    @IsInt()
    @EntityDefinition.field({ label: "Thứ tự", required: true })
    sequence: number;

    /**
     * Thời lượng dự kiến (phút)
     */
    @IsInt()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời lượng dự kiến (phút)" })
    plannedMinutes?: number;

    /**
     * Việc tồn từ kỳ trước
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Việc tồn từ kỳ trước" })
    carriedFromActionItemId?: string;
}
