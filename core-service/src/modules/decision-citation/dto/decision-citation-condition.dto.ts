import { PartialType } from "@nestjs/swagger";
import { DecisionCitation } from "../entities/decision-citation.entity";

export class DecisionCitationConditionDto extends PartialType(DecisionCitation) {}
