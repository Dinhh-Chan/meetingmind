import { PartialType } from "@nestjs/swagger";
import { WorkspaceSetting } from "../entities/workspace-setting.entity";

export class WorkspaceSettingConditionDto extends PartialType(WorkspaceSetting) {}
