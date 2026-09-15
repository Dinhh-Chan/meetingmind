import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
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
        routes: {
            getMany: { permission: Permission.WORKSPACE_VIEW },
            getPage: { permission: Permission.WORKSPACE_VIEW },
            getOne: { permission: Permission.WORKSPACE_VIEW },
            getById: { permission: Permission.WORKSPACE_VIEW },
            exportDefinition: { permission: Permission.WORKSPACE_VIEW },
            exportXlsx: { permission: Permission.WORKSPACE_VIEW },
            create: { permission: Permission.WORKSPACE_SETTINGS_UPDATE },
            upsert: { permission: Permission.WORKSPACE_SETTINGS_UPDATE },
            getOneOrUpsert: { permission: Permission.WORKSPACE_SETTINGS_UPDATE },
            updateById: { permission: Permission.WORKSPACE_SETTINGS_UPDATE },
            updateByIds: { permission: Permission.WORKSPACE_SETTINGS_UPDATE },
            deleteById: { permission: Permission.WORKSPACE_SETTINGS_UPDATE },
            deleteByIds: { permission: Permission.WORKSPACE_SETTINGS_UPDATE },
        },
    },
) {
    constructor(private readonly workspaceSettingService: WorkspaceSettingService) {
        super(workspaceSettingService);
    }
}
