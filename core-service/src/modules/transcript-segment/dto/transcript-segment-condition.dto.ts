import { PartialType } from "@nestjs/swagger";
import { TranscriptSegment } from "../entities/transcript-segment.entity";

export class TranscriptSegmentConditionDto extends PartialType(TranscriptSegment) {}
