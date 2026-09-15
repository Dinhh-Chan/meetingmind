import { OmitType } from "@nestjs/swagger";
import { RecordingConsent } from "../entities/recording-consent.entity";

export class CreateRecordingConsentDto extends OmitType(RecordingConsent, ["_id"] as const) {}
