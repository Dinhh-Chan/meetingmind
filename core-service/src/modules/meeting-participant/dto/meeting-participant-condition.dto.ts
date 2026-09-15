import { PartialType } from "@nestjs/swagger";
import { MeetingParticipant } from "../entities/meeting-participant.entity";

export class MeetingParticipantConditionDto extends PartialType(MeetingParticipant) {}
