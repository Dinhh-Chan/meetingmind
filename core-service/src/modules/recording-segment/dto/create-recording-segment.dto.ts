import { OmitType } from "@nestjs/swagger";
import { RecordingSegment } from "../entities/recording-segment.entity";

export class CreateRecordingSegmentDto extends OmitType(RecordingSegment, ["_id"] as const) {}
