import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { Workspace } from "../entities/workspace.entity";
import { WorkspaceRepository } from "../repositories/workspace-repository.interface";

@Injectable()
export class WorkspaceService extends BaseService<Workspace, WorkspaceRepository> {
    constructor(
        @InjectRepository(Entity.WORKSPACE)
        private readonly workspaceRepository: WorkspaceRepository,
    ) {
        super(workspaceRepository);
    }
}
