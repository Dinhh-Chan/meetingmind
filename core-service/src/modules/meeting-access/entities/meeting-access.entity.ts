import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { MeetingAccessRole } from "../common/constant";

export class MeetingAccess implements BaseEntity {
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
     * Người dùng
     */
    @IsString()
    @EntityDefinition.field({ label: "Người dùng", required: true })
    userId: string;

    /**
     * Vai trò trên cuộc họp
     */
    @IsEnum(MeetingAccessRole)
    @EntityDefinition.field({ label: "Vai trò trên cuộc họp", required: true, enum: Object.values(MeetingAccessRole) })
    role: MeetingAccessRole;

    /**
     * Người cấp quyền
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người cấp quyền" })
    grantedById?: string;
}
