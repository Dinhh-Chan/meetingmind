import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { Workspace } from "../entities/workspace.entity";
import { WorkspaceModel } from "../models/workspace.model";
import { WorkspaceRepository } from "./workspace-repository.interface";

@Injectable()
export class WorkspaceSqlRepository
    extends SqlRepository<Workspace>
    implements WorkspaceRepository
{
    constructor(
        @InjectModel(WorkspaceModel)
        private readonly workspaceModel: ModelCtor<WorkspaceModel>,
    ) {
        super(workspaceModel);
    }
}
