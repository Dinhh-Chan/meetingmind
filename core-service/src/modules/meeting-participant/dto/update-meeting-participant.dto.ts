import { PartialType } from "@nestjs/swagger";
import { CreateMeetingParticipantDto } from "./create-meeting-participant.dto";

export class UpdateMeetingParticipantDto extends PartialType(CreateMeetingParticipantDto) {}
