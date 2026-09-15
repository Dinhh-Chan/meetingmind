import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { WorkspaceSetting } from "../entities/workspace-setting.entity";
import { WorkspaceSettingModel } from "../models/workspace-setting.model";
import { WorkspaceSettingRepository } from "./workspace-setting-repository.interface";

@Injectable()
export class WorkspaceSettingSqlRepository
    extends SqlRepository<WorkspaceSetting>
    implements WorkspaceSettingRepository
{
    constructor(
        @InjectModel(WorkspaceSettingModel)
        private readonly workspaceSettingModel: ModelCtor<WorkspaceSettingModel>,
    ) {
        super(workspaceSettingModel);
    }
}
