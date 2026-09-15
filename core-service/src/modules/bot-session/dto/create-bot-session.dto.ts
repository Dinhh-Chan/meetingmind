import { OmitType } from "@nestjs/swagger";
import { BotSession } from "../entities/bot-session.entity";

export class CreateBotSessionDto extends OmitType(BotSession, ["_id"] as const) {}
