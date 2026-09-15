import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { NoteType, NoteVisibility } from "../common/constant";

export class Note implements BaseEntity {
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
     * Mục agenda
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Mục agenda" })
    agendaItemId?: string;

    /**
     * Người ghi
     */
    @IsString()
    @EntityDefinition.field({ label: "Người ghi", required: true })
    authorId: string;

    /**
     * Loại ghi chú
     */
    @IsEnum(NoteType)
    @EntityDefinition.field({ label: "Loại ghi chú", required: true, enum: Object.values(NoteType) })
    type: NoteType;

    /**
     * Phạm vi
     */
    @IsEnum(NoteVisibility)
    @EntityDefinition.field({ label: "Phạm vi", required: true, enum: Object.values(NoteVisibility) })
    visibility: NoteVisibility;

    /**
     * Thời điểm chủ sở hữu cho phép chia sẻ
     */
    @IsDateString()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời điểm chủ sở hữu cho phép chia sẻ" })
    sharedAt?: Date;

    /**
     * Nội dung
     */
    @IsString()
    @EntityDefinition.field({ label: "Nội dung", required: true })
    body: string;

    /**
     * Checklist
     */
    @IsArray()
    @IsOptional()
    @EntityDefinition.field({ label: "Checklist" })
    checklist?: Record<string, any>[];

    /**
     * Tag
     */
    @IsArray()
    @IsOptional()
    @EntityDefinition.field({ label: "Tag" })
    tags?: Record<string, any>[];

    /**
     * Mốc thời gian trong bản ghi (ms)
     */
    @IsInt()
    @IsOptional()
    @EntityDefinition.field({ label: "Mốc thời gian trong bản ghi (ms)" })
    recordingMs?: number;

    /**
     * Đoạn transcript nguồn
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Đoạn transcript nguồn" })
    transcriptSegmentId?: string;

    /**
     * Thời điểm xóa mềm
     */
    @IsOptional()
    @IsDateString()
    @EntityDefinition.field({ label: "Thời điểm xóa mềm" })
    deletedAt?: Date;
}
