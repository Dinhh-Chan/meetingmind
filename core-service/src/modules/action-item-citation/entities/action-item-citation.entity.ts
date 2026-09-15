import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { CitationSourceType } from "../common/constant";

export class ActionItemCitation implements BaseEntity {
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
     * Công việc
     */
    @IsString()
    @EntityDefinition.field({ label: "Công việc", required: true })
    actionItemId: string;

    /**
     * Cuộc họp
     */
    @IsString()
    @EntityDefinition.field({ label: "Cuộc họp", required: true })
    meetingId: string;

    /**
     * Loại nguồn
     */
    @IsEnum(CitationSourceType)
    @EntityDefinition.field({ label: "Loại nguồn", required: true, enum: Object.values(CitationSourceType) })
    sourceType: CitationSourceType;

    /**
     * Đoạn transcript
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Đoạn transcript" })
    transcriptSegmentId?: string;

    /**
     * Phiên bản transcript đã dùng lúc duyệt
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Phiên bản transcript đã dùng lúc duyệt" })
    transcriptVersionId?: string;

    /**
     * Ghi chú
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Ghi chú" })
    noteId?: string;

    /**
     * Thời điểm bắt đầu (ms)
     */
    @IsInt()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời điểm bắt đầu (ms)" })
    startMs?: number;

    /**
     * Thời điểm kết thúc (ms)
     */
    @IsInt()
    @IsOptional()
    @EntityDefinition.field({ label: "Thời điểm kết thúc (ms)" })
    endMs?: number;

    /**
     * Trích đoạn
     */
    @IsString()
    @EntityDefinition.field({ label: "Trích đoạn", required: true })
    quote: string;
}
