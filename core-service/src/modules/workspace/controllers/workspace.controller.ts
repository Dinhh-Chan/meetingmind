import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { SystemRole } from "@module/user/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateWorkspaceDto } from "../dto/create-workspace.dto";
import { WorkspaceConditionDto } from "../dto/workspace-condition.dto";
import { UpdateWorkspaceDto } from "../dto/update-workspace.dto";
import { Workspace } from "../entities/workspace.entity";
import { WorkspaceService } from "../services/workspace.service";

@Controller("workspace")
@ApiTags("workspace")
export class WorkspaceController extends BaseControllerFactory<Workspace>(
    Workspace,
    WorkspaceConditionDto,
    CreateWorkspaceDto,
    UpdateWorkspaceDto,
    {
        import: { enable: false },
        routes: {
            // Tạo workspace là điểm khởi đầu: lúc này người dùng chưa thuộc
            // workspace nào nên không thể xét quyền theo vai trò. Mở cho mọi
            // tài khoản đã đăng nhập; người tạo tự động thành OWNER.
            create: { roles: [SystemRole.SUPER_ADMIN, SystemRole.USER] },
            upsert: { enable: false },
            getOneOrUpsert: { enable: false },
            getMany: { permission: Permission.WORKSPACE_VIEW },
            getPage: { permission: Permission.WORKSPACE_VIEW },
            getOne: { permission: Permission.WORKSPACE_VIEW },
            getById: { permission: Permission.WORKSPACE_VIEW },
            exportDefinition: { permission: Permission.WORKSPACE_VIEW },
            exportXlsx: { permission: Permission.WORKSPACE_VIEW },
            updateById: { permission: Permission.WORKSPACE_SETTINGS_UPDATE },
            updateByIds: { permission: Permission.WORKSPACE_SETTINGS_UPDATE },
            deleteById: { permission: Permission.WORKSPACE_DELETE },
            deleteByIds: { permission: Permission.WORKSPACE_DELETE },
        },
    },
) {
    constructor(private readonly workspaceService: WorkspaceService) {
        super(workspaceService);
    }
}
