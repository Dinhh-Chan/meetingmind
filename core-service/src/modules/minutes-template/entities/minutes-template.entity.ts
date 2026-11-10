import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsArray, IsOptional, IsString } from "class-validator";

/**
 * Mẫu biên bản của workspace: danh sách mục theo thứ tự. Dự án chọn một mẫu;
 * AI viết biên bản cuộc họp của dự án theo đúng các mục đó.
 */
export class MinutesTemplate implements BaseEntity {
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
     * Tên mẫu
     */
    @IsString()
    @EntityDefinition.field({ label: "Tên mẫu", required: true })
    name: string;

    /**
     * Các mục, theo thứ tự
     */
    @IsArray()
    @EntityDefinition.field({ label: "Các mục", required: true })
    sections: string[];

    /**
     * Người tạo
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người tạo" })
    createdById?: string;
}
