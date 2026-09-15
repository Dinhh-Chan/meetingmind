import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString } from "class-validator";
import { SpeakerIdentityStatus } from "../common/constant";

export class TranscriptSegment implements BaseEntity {
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
     * Người nói
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Người nói" })
    speakerUserId?: string;

    /**
     * Trạng thái xác định danh tính
     */
    @IsEnum(SpeakerIdentityStatus)
    @EntityDefinition.field({ label: "Trạng thái xác định danh tính", required: true, enum: Object.values(SpeakerIdentityStatus) })
    identityStatus: SpeakerIdentityStatus;

    /**
     * Thời điểm bắt đầu (ms)
     */
    @IsInt()
    @EntityDefinition.field({ label: "Thời điểm bắt đầu (ms)", required: true })
    startMs: number;

    /**
     * Thời điểm kết thúc (ms)
     */
    @IsInt()
    @EntityDefinition.field({ label: "Thời điểm kết thúc (ms)", required: true })
    endMs: number;

    /**
     * Nội dung
     */
    @IsString()
    @EntityDefinition.field({ label: "Nội dung", required: true })
    text: string;

    /**
     * Nội dung gốc từ STT
     */
    @IsString()
    @IsOptional()
    @EntityDefinition.field({ label: "Nội dung gốc từ STT" })
    rawText?: string;

    /**
     * Độ tin cậy
     */
    @IsNumber()
    @IsOptional()
    @EntityDefinition.field({ label: "Độ tin cậy" })
    confidence?: number;

    /**
     * Nói chồng / không nghe rõ
     */
    @IsBoolean()
    @IsOptional()
    @EntityDefinition.field({ label: "Nói chồng / không nghe rõ" })
    isOverlapping?: boolean;

    /**
     * Thứ tự
     */
    @IsInt()
    @EntityDefinition.field({ label: "Thứ tự", required: true })
    sequence: number;
}
