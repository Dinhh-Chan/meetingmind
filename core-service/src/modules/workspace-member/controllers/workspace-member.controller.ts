import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly workspaceMemberService: WorkspaceMemberService) {
        super(workspaceMemberService);
    }
}
