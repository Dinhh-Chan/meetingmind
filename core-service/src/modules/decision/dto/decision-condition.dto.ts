import { PartialType } from "@nestjs/swagger";
import { Decision } from "../entities/decision.entity";

export class DecisionConditionDto extends PartialType(Decision) {}
