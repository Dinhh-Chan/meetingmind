import { EntityDefinition } from "@common/constant/class/entity-definition";
import { BaseEntity } from "@common/interface/base-entity.interface";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { RecordingGapReason } from "../common/constant";

export class RecordingSegment implements BaseEntity {
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
     * File
     */
    @IsString()
    @EntityDefinition.field({ label: "File", required: true })
    fileId: string;

    /**
     * Thứ tự đoạn
     */
    @IsInt()
    @EntityDefinition.field({ label: "Thứ tự đoạn", required: true })
    sequence: number;

    /**
     * Mốc so với đầu cuộc họp (ms)
     */
    @IsInt()
    @EntityDefinition.field({ label: "Mốc so với đầu cuộc họp (ms)", required: true })
    startOffsetMs: number;

    /**
     * Thời lượng (ms)
     */
    @IsInt()
    @EntityDefinition.field({ label: "Thời lượng (ms)", required: true })
    durationMs: number;

    /**
     * Có gián đoạn trước đoạn này
     */
    @IsBoolean()
    @EntityDefinition.field({ label: "Có gián đoạn trước đoạn này", required: true })
    hasGapBefore: boolean;

    /**
     * Lý do gián đoạn
     */
    @IsEnum(RecordingGapReason)
    @IsOptional()
    @EntityDefinition.field({ label: "Lý do gián đoạn", enum: Object.values(RecordingGapReason) })
    gapReason?: RecordingGapReason;
}
