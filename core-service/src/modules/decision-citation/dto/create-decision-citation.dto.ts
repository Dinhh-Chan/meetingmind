import { OmitType } from "@nestjs/swagger";
import { DecisionCitation } from "../entities/decision-citation.entity";

export class CreateDecisionCitationDto extends OmitType(DecisionCitation, ["_id"] as const) {}
