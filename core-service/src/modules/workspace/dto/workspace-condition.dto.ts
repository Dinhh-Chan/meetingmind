import { PartialType } from "@nestjs/swagger";
import { Workspace } from "../entities/workspace.entity";

export class WorkspaceConditionDto extends PartialType(Workspace) {}
