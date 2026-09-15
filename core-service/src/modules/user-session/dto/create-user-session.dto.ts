import { OmitType } from "@nestjs/swagger";
import { UserSession } from "../entities/user-session.entity";

export class CreateUserSessionDto extends OmitType(UserSession, ["_id"] as const) {}
