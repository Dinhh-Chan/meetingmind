import { PartialType } from "@nestjs/swagger";
import { CreateMeetingMinutesDto } from "./create-meeting-minutes.dto";

export class UpdateMeetingMinutesDto extends PartialType(CreateMeetingMinutesDto) {}
