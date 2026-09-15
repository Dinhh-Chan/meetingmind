import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateWorkspaceMemberDto } from "../dto/create-workspace-member.dto";
import { WorkspaceMemberConditionDto } from "../dto/workspace-member-condition.dto";
import { UpdateWorkspaceMemberDto } from "../dto/update-workspace-member.dto";
import { WorkspaceMember } from "../entities/workspace-member.entity";
import { WorkspaceMemberService } from "../services/workspace-member.service";

@Controller("workspace-member")
@ApiTags("workspace-member")
export class WorkspaceMemberController extends BaseControllerFactory<WorkspaceMember>(
    WorkspaceMember,
    WorkspaceMemberConditionDto,
    CreateWorkspaceMemberDto,
    UpdateWorkspaceMemberDto,
    {
        import: { enable: false },
        routes: {
            getMany: { permission: Permission.WORKSPACE_VIEW },
            getPage: { permission: Permission.WORKSPACE_VIEW },
            getOne: { permission: Permission.WORKSPACE_VIEW },
            getById: { permission: Permission.WORKSPACE_VIEW },
            exportDefinition: { permission: Permission.WORKSPACE_VIEW },
            exportXlsx: { permission: Permission.WORKSPACE_VIEW },
            create: { permission: Permission.WORKSPACE_MEMBER_INVITE },
            upsert: { permission: Permission.WORKSPACE_MEMBER_INVITE },
            getOneOrUpsert: { permission: Permission.WORKSPACE_MEMBER_INVITE },
            updateById: { permission: Permission.WORKSPACE_MEMBER_MANAGE },
            updateByIds: { permission: Permission.WORKSPACE_MEMBER_MANAGE },
            deleteById: { permission: Permission.WORKSPACE_MEMBER_MANAGE },
            deleteByIds: { permission: Permission.WORKSPACE_MEMBER_MANAGE },
        },
    },
) {
    constructor(private readonly workspaceMemberService: WorkspaceMemberService) {
        super(workspaceMemberService);
    }
}
