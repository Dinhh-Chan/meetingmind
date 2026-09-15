import { PartialType } from "@nestjs/swagger";
import { CreateDecisionCitationDto } from "./create-decision-citation.dto";

export class UpdateDecisionCitationDto extends PartialType(CreateDecisionCitationDto) {}
