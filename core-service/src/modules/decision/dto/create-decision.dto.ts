import { OmitType } from "@nestjs/swagger";
import { Decision } from "../entities/decision.entity";

export class CreateDecisionDto extends OmitType(Decision, ["_id"] as const) {}
