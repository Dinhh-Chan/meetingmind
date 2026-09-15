import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { MeetingParticipantRole } from "../common/constant";

export class MeetingParticipant implements BaseEntity {
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
    @IsOptional()
    @EntityDefinition.field({ label: "Người dùng" })
    userId?: string;

    /**
     * Tên hiển thị
     */
    @IsString()
    @EntityDefinition.field({ label: "Tên hiển thị", required: true })
    displayName: string;

    /**
     * Email
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Email" })
    email?: string;

    /**
     * Vai trò
     */
    @IsEnum(MeetingParticipantRole)
    @IsOptional()
    @EntityDefinition.field({ label: "Vai trò", enum: Object.values(MeetingParticipantRole) })
    role?: MeetingParticipantRole;
}
