import { OmitType } from "@nestjs/swagger";
import { MeetingAccess } from "../entities/meeting-access.entity";

export class CreateMeetingAccessDto extends OmitType(MeetingAccess, ["_id"] as const) {}
