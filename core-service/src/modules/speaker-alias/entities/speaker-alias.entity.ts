import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsDateString, IsOptional, IsString } from "class-validator";

export class SpeakerAlias implements BaseEntity {
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
     * Phiên bản transcript
     */
    @IsString()
    @EntityDefinition.field({ label: "Phiên bản transcript", required: true })
    transcriptVersionId: string;

    /**
     * Nhãn người nói
     */
    @IsString()
    @EntityDefinition.field({ label: "Nhãn người nói", required: true })
    speakerLabel: string;

    /**
     * Tên hiển thị
     */
    @IsString()
    @EntityDefinition.field({ label: "Tên hiển thị", required: true })
    displayName: string;

    /**
     * Người dùng
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người dùng" })
    userId?: string;

    /**
     * Người xác nhận
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người xác nhận" })
    confirmedById?: string;

    /**
     * Thời điểm xác nhận
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời điểm xác nhận" })
    confirmedAt?: Date;
}
