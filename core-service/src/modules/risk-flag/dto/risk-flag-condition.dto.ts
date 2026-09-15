import { PartialType } from "@nestjs/swagger";
import { RiskFlag } from "../entities/risk-flag.entity";

export class RiskFlagConditionDto extends PartialType(RiskFlag) {}
