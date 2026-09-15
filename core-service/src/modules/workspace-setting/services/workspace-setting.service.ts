import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { WorkspaceSetting } from "../entities/workspace-setting.entity";
import { WorkspaceSettingRepository } from "../repositories/workspace-setting-repository.interface";

@Injectable()
export class WorkspaceSettingService extends BaseService<WorkspaceSetting, WorkspaceSettingRepository> {
    constructor(
        @InjectRepository(Entity.WORKSPACE_SETTING)
        private readonly workspaceSettingRepository: WorkspaceSettingRepository,
    ) {
        super(workspaceSettingRepository);
    }
}
