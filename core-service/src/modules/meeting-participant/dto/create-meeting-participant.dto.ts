import { OmitType } from "@nestjs/swagger";
import { MeetingParticipant } from "../entities/meeting-participant.entity";

export class CreateMeetingParticipantDto extends OmitType(MeetingParticipant, ["_id"] as const) {}
