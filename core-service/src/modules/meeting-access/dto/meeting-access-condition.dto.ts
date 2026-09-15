import { PartialType } from "@nestjs/swagger";
import { MeetingAccess } from "../entities/meeting-access.entity";

export class MeetingAccessConditionDto extends PartialType(MeetingAccess) {}
