import { PartialType } from "@nestjs/swagger";
import { Meeting } from "../entities/meeting.entity";

export class MeetingConditionDto extends PartialType(Meeting) {}
