import { OmitType } from "@nestjs/swagger";
import { MinutesVersion } from "../entities/minutes-version.entity";

export class CreateMinutesVersionDto extends OmitType(MinutesVersion, ["_id"] as const) {}
