import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsOptional, IsString } from "class-validator";

export class MeetingMinutes implements BaseEntity {
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
     * Phiên bản hiện tại
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Phiên bản hiện tại" })
    currentVersionId?: string;

    /**
     * Phiên bản đã duyệt
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Phiên bản đã duyệt" })
    approvedVersionId?: string;
}
