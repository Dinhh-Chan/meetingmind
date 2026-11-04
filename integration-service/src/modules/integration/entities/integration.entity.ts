import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsEnum, IsObject, IsOptional, IsString } from "class-validator";
import { IntegrationProvider, IntegrationStatus } from "../common/constant";

/**
 * Một kết nối tới công cụ ngoài. Không lưu bí mật ở đây khi cấu hình đi từ
 * env; cột token mã hoá trong thiết kế sẽ thêm khi có luồng OAuth.
 */
export class Integration implements BaseEntity {
    /**
     * ID
     */
    @IsOptional()
    @IsString()
    _id: string;

    /**
     * ID workspace (tham chiếu logic sang Core)
     */
    @IsString()
    @EntityDefinition.field({ label: "ID workspace", required: true })
    workspaceId: string;

    /**
     * Nhà cung cấp
     */
    @IsEnum(IntegrationProvider)
    @EntityDefinition.field({
        label: "Nhà cung cấp",
        required: true,
        enum: Object.values(IntegrationProvider),
    })
    provider: IntegrationProvider;

    /**
     * Định danh tài khoản/site bên ngoài
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Định danh tài khoản ngoài" })
    externalAccountId?: string;

    /**
     * Tên hiển thị
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Tên hiển thị" })
    displayName?: string;

    /**
     * Trạng thái
     */
    @IsEnum(IntegrationStatus)
    @EntityDefinition.field({
        label: "Trạng thái",
        required: true,
        enum: Object.values(IntegrationStatus),
    })
    status: IntegrationStatus;

    /**
     * Cấu hình không bí mật: list Trello, chat Telegram...
     */
    @IsObject()
    @IsOptional()
    @EntityDefinition.field({ label: "Cấu hình" })
    config?: Record<string, any>;

    /**
     * Lỗi gần nhất
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Lỗi gần nhất" })
    lastError?: string;
}
