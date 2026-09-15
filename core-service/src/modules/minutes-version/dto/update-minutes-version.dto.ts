import { PartialType } from "@nestjs/swagger";
import { CreateMinutesVersionDto } from "./create-minutes-version.dto";

export class UpdateMinutesVersionDto extends PartialType(CreateMinutesVersionDto) {}
