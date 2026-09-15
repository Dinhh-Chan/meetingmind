import { OmitType } from "@nestjs/swagger";
import { ProjectMember } from "../entities/project-member.entity";

export class CreateProjectMemberDto extends OmitType(ProjectMember, ["_id"] as const) {}
