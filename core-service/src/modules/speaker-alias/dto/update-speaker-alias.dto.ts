import { PartialType } from "@nestjs/swagger";
import { CreateSpeakerAliasDto } from "./create-speaker-alias.dto";

export class UpdateSpeakerAliasDto extends PartialType(CreateSpeakerAliasDto) {}
