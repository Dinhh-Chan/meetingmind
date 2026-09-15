import { PartialType } from "@nestjs/swagger";
import { UserSession } from "../entities/user-session.entity";

export class UserSessionConditionDto extends PartialType(UserSession) {}
