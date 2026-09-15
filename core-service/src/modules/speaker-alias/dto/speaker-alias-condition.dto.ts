import { PartialType } from "@nestjs/swagger";
import { SpeakerAlias } from "../entities/speaker-alias.entity";

export class SpeakerAliasConditionDto extends PartialType(SpeakerAlias) {}
