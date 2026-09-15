import { PartialType } from "@nestjs/swagger";
import { CreateRecordingConsentDto } from "./create-recording-consent.dto";

export class UpdateRecordingConsentDto extends PartialType(CreateRecordingConsentDto) {}
