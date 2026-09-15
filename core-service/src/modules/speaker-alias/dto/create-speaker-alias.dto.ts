import { OmitType } from "@nestjs/swagger";
import { SpeakerAlias } from "../entities/speaker-alias.entity";

export class CreateSpeakerAliasDto extends OmitType(SpeakerAlias, ["_id"] as const) {}
