import { PartialType } from "@nestjs/swagger";
import { WorkspaceMember } from "../entities/workspace-member.entity";

export class WorkspaceMemberConditionDto extends PartialType(WorkspaceMember) {}
