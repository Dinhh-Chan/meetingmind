import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateProjectMemberDto } from "../dto/create-project-member.dto";
import { ProjectMemberConditionDto } from "../dto/project-member-condition.dto";
import { UpdateProjectMemberDto } from "../dto/update-project-member.dto";
import { ProjectMember } from "../entities/project-member.entity";
import { ProjectMemberService } from "../services/project-member.service";

@Controller("project-member")
@ApiTags("project-member")
export class ProjectMemberController extends BaseControllerFactory<ProjectMember>(
    ProjectMember,
    ProjectMemberConditionDto,
    CreateProjectMemberDto,
    UpdateProjectMemberDto,
    {
        import: { enable: false },
        routes: {
            getMany: { permission: Permission.PROJECT_VIEW },
            getPage: { permission: Permission.PROJECT_VIEW },
            getOne: { permission: Permission.PROJECT_VIEW },
            getById: { permission: Permission.PROJECT_VIEW },
            exportDefinition: { permission: Permission.PROJECT_VIEW },
            exportXlsx: { permission: Permission.PROJECT_VIEW },
            create: { permission: Permission.PROJECT_MEMBER_MANAGE },
            upsert: { permission: Permission.PROJECT_MEMBER_MANAGE },
            getOneOrUpsert: { permission: Permission.PROJECT_MEMBER_MANAGE },
            updateById: { permission: Permission.PROJECT_MEMBER_MANAGE },
            updateByIds: { permission: Permission.PROJECT_MEMBER_MANAGE },
            deleteById: { permission: Permission.PROJECT_MEMBER_MANAGE },
            deleteByIds: { permission: Permission.PROJECT_MEMBER_MANAGE },
        },
    },
) {
    constructor(private readonly projectMemberService: ProjectMemberService) {
        super(projectMemberService);
    }
}
