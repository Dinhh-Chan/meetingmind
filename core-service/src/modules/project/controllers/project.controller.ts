import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Permission } from "@module/permission/common/constant";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateProjectDto } from "../dto/create-project.dto";
import { ProjectConditionDto } from "../dto/project-condition.dto";
import { UpdateProjectDto } from "../dto/update-project.dto";
import { Project } from "../entities/project.entity";
import { ProjectService } from "../services/project.service";

@Controller("project")
@ApiTags("project")
export class ProjectController extends BaseControllerFactory<Project>(
    Project,
    ProjectConditionDto,
    CreateProjectDto,
    UpdateProjectDto,
    {
        import: { enable: false },
        scopeParam: "projectId",
        routes: {
            getMany: { permission: Permission.PROJECT_VIEW },
            getPage: { permission: Permission.PROJECT_VIEW },
            getOne: { permission: Permission.PROJECT_VIEW },
            getById: { permission: Permission.PROJECT_VIEW },
            exportDefinition: { permission: Permission.PROJECT_VIEW },
            exportXlsx: { permission: Permission.PROJECT_VIEW },
            create: { permission: Permission.PROJECT_CREATE },
            upsert: { permission: Permission.PROJECT_CREATE },
            getOneOrUpsert: { permission: Permission.PROJECT_CREATE },
            updateById: { permission: Permission.PROJECT_UPDATE },
            updateByIds: { permission: Permission.PROJECT_UPDATE },
            deleteById: { permission: Permission.PROJECT_DELETE },
            deleteByIds: { permission: Permission.PROJECT_DELETE },
        },
    },
) {
    constructor(private readonly projectService: ProjectService) {
        super(projectService);
    }
}
