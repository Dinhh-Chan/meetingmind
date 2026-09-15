import { OmitType } from "@nestjs/swagger";
import { TranscriptVersion } from "../entities/transcript-version.entity";

export class CreateTranscriptVersionDto extends OmitType(TranscriptVersion, ["_id"] as const) {}
