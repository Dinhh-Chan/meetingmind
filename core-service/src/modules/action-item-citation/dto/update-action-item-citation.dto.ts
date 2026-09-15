import { PartialType } from "@nestjs/swagger";
import { CreateActionItemCitationDto } from "./create-action-item-citation.dto";

export class UpdateActionItemCitationDto extends PartialType(CreateActionItemCitationDto) {}
