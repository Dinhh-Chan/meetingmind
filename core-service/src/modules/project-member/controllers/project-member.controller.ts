import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly projectMemberService: ProjectMemberService) {
        super(projectMemberService);
    }
}
