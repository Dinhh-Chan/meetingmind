import { PartialType } from "@nestjs/swagger";
import { RecordingSegment } from "../entities/recording-segment.entity";

export class RecordingSegmentConditionDto extends PartialType(RecordingSegment) {}
