import { OmitType } from "@nestjs/swagger";
import { Meeting } from "../entities/meeting.entity";

export class CreateMeetingDto extends OmitType(Meeting, ["_id"] as const) {}
