import { OmitType } from "@nestjs/swagger";
import { TranscriptSegment } from "../entities/transcript-segment.entity";

export class CreateTranscriptSegmentDto extends OmitType(TranscriptSegment, ["_id"] as const) {}
