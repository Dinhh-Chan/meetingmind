import { PartialType } from "@nestjs/swagger";
import { ProjectMember } from "../entities/project-member.entity";

export class ProjectMemberConditionDto extends PartialType(ProjectMember) {}
