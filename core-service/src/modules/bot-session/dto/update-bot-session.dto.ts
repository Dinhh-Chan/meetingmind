import { PartialType } from "@nestjs/swagger";
import { CreateBotSessionDto } from "./create-bot-session.dto";

export class UpdateBotSessionDto extends PartialType(CreateBotSessionDto) {}
