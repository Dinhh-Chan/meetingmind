import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
import { OauthProvider } from "../common/constant";

export class OauthAccount implements BaseEntity {
    /**
     * ID
     */
    @IsOptional()
    @IsString()
    _id: string;

    /**
     * Người dùng
     */
    @IsString()
    @EntityDefinition.field({ label: "Người dùng", required: true })
    userId: string;

    /**
     * Nhà cung cấp
     */
    @IsEnum(OauthProvider)
    @EntityDefinition.field({ label: "Nhà cung cấp", required: true, enum: Object.values(OauthProvider) })
    provider: OauthProvider;

    /**
     * ID tài khoản phía provider
     */
    @IsString()
    @EntityDefinition.field({ label: "ID tài khoản phía provider", required: true })
    providerAccountId: string;

    /**
     * Email
     */
    @IsString()
    @EntityDefinition.field({ label: "Email", required: true })
    email: string;

    /**
     * Thời điểm xóa mềm
     */
    @IsOptional()
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm xóa mềm" })
    deletedAt?: Date;
}
