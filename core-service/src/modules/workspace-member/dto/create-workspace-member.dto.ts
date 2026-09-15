import { OmitType } from "@nestjs/swagger";
import { WorkspaceMember } from "../entities/workspace-member.entity";

export class CreateWorkspaceMemberDto extends OmitType(WorkspaceMember, ["_id"] as const) {}
