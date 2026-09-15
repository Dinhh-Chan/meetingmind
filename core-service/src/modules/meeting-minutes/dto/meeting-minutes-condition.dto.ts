import { PartialType } from "@nestjs/swagger";
import { MeetingMinutes } from "../entities/meeting-minutes.entity";

export class MeetingMinutesConditionDto extends PartialType(MeetingMinutes) {}
