import { PartialType } from "@nestjs/swagger";
import { RecordingConsent } from "../entities/recording-consent.entity";

export class RecordingConsentConditionDto extends PartialType(RecordingConsent) {}
