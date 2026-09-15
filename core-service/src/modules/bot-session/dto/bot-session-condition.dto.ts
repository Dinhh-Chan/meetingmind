import { PartialType } from "@nestjs/swagger";
import { BotSession } from "../entities/bot-session.entity";

export class BotSessionConditionDto extends PartialType(BotSession) {}
