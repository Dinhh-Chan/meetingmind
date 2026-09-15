import { OmitType } from "@nestjs/swagger";
import { MeetingMinutes } from "../entities/meeting-minutes.entity";

export class CreateMeetingMinutesDto extends OmitType(MeetingMinutes, ["_id"] as const) {}
