import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly projectService: ProjectService) {
        super(projectService);
    }
}
