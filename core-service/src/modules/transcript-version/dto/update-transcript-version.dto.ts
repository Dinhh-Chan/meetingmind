import { PartialType } from "@nestjs/swagger";
import { CreateTranscriptVersionDto } from "./create-transcript-version.dto";

export class UpdateTranscriptVersionDto extends PartialType(CreateTranscriptVersionDto) {}
