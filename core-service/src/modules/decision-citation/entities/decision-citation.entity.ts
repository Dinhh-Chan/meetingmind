import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsInt, IsOptional, IsString } from "class-validator";

export class DecisionCitation implements BaseEntity {
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
     * Quyết định
     */
    @IsString()
    @EntityDefinition.field({ label: "Quyết định", required: true })
    decisionId: string;

    /**
     * Đoạn transcript
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Đoạn transcript" })
    transcriptSegmentId?: string;

    /**
     * Ghi chú
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Ghi chú" })
    noteId?: string;

    /**
     * Phiên bản transcript đã dùng lúc duyệt
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Phiên bản transcript đã dùng lúc duyệt" })
    transcriptVersionId?: string;

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
