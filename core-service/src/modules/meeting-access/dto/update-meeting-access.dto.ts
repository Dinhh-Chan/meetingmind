import { PartialType } from "@nestjs/swagger";
import { CreateMeetingAccessDto } from "./create-meeting-access.dto";

export class UpdateMeetingAccessDto extends PartialType(CreateMeetingAccessDto) {}
