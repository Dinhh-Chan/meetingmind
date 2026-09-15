import { OmitType } from "@nestjs/swagger";
import { WorkspaceSetting } from "../entities/workspace-setting.entity";

export class CreateWorkspaceSettingDto extends OmitType(WorkspaceSetting, ["_id"] as const) {}
