import { PartialType } from "@nestjs/swagger";
import { MinutesVersion } from "../entities/minutes-version.entity";

export class MinutesVersionConditionDto extends PartialType(MinutesVersion) {}
