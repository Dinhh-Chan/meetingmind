import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateWorkspaceSettingDto } from "../dto/create-workspace-setting.dto";
import { WorkspaceSettingConditionDto } from "../dto/workspace-setting-condition.dto";
import { UpdateWorkspaceSettingDto } from "../dto/update-workspace-setting.dto";
import { WorkspaceSetting } from "../entities/workspace-setting.entity";
import { WorkspaceSettingService } from "../services/workspace-setting.service";

@Controller("workspace-setting")
@ApiTags("workspace-setting")
export class WorkspaceSettingController extends BaseControllerFactory<WorkspaceSetting>(
    WorkspaceSetting,
    WorkspaceSettingConditionDto,
    CreateWorkspaceSettingDto,
    UpdateWorkspaceSettingDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly workspaceSettingService: WorkspaceSettingService) {
        super(workspaceSettingService);
    }
}
