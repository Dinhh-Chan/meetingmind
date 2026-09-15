import { BaseControllerFactory } from "@config/controller/base-controller-factory";
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
    },
) {
    constructor(private readonly workspaceService: WorkspaceService) {
        super(workspaceService);
    }
}
