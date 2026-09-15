import { PartialType } from "@nestjs/swagger";
import { CreateWorkspaceSettingDto } from "./create-workspace-setting.dto";

export class UpdateWorkspaceSettingDto extends PartialType(CreateWorkspaceSettingDto) {}
