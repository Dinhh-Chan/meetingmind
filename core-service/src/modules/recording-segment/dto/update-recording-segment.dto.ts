import { PartialType } from "@nestjs/swagger";
import { CreateRecordingSegmentDto } from "./create-recording-segment.dto";

export class UpdateRecordingSegmentDto extends PartialType(CreateRecordingSegmentDto) {}
