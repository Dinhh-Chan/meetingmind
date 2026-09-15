import { OmitType } from "@nestjs/swagger";
import { RiskFlag } from "../entities/risk-flag.entity";

export class CreateRiskFlagDto extends OmitType(RiskFlag, ["_id"] as const) {}
