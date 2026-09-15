import { PartialType } from "@nestjs/swagger";
import { TranscriptVersion } from "../entities/transcript-version.entity";

export class TranscriptVersionConditionDto extends PartialType(TranscriptVersion) {}
