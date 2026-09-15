import { OmitType } from "@nestjs/swagger";
import { Workspace } from "../entities/workspace.entity";

export class CreateWorkspaceDto extends OmitType(Workspace, ["_id"] as const) {}
