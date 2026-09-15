import { PartialType } from "@nestjs/swagger";
import { CreateTranscriptSegmentDto } from "./create-transcript-segment.dto";

export class UpdateTranscriptSegmentDto extends PartialType(CreateTranscriptSegmentDto) {}
