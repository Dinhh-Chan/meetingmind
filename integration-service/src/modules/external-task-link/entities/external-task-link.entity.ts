import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { IntegrationProvider } from "@module/integration/common/constant";
import { ExternalSyncStatus } from "../common/constant";

/** Công việc trong MeetingMind ứng với thẻ/issue nào bên ngoài. */
export class ExternalTaskLink implements BaseEntity {
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
     * Kết nối dùng để đồng bộ
     */
    @IsString()
    @EntityDefinition.field({ label: "ID kết nối", required: true })
    integrationId: string;

    /**
     * ID công việc (tham chiếu logic sang Core, không FK)
     */
    @IsString()
    @EntityDefinition.field({ label: "ID công việc", required: true })
    actionItemId: string;

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
     * ID bên ngoài (ID thẻ Trello)
     */
    @IsString()
    @EntityDefinition.field({ label: "ID bên ngoài", required: true })
    externalId: string;

    /**
     * Mã bên ngoài, ví dụ PROJ-123
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Mã bên ngoài" })
    externalKey?: string;

    /**
     * Đường dẫn bên ngoài
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Đường dẫn bên ngoài" })
    externalUrl?: string;

    /**
     * Lần đồng bộ gần nhất
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Lần đồng bộ gần nhất" })
    lastSyncedAt?: Date;

    /**
     * Trạng thái đồng bộ
     */
    @IsEnum(ExternalSyncStatus)
    @EntityDefinition.field({
        label: "Trạng thái đồng bộ",
        required: true,
        enum: Object.values(ExternalSyncStatus),
    })
    syncStatus: ExternalSyncStatus;

    /**
     * Lỗi gần nhất
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Lỗi gần nhất" })
    lastError?: string;
}
