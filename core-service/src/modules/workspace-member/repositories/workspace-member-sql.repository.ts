import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { WorkspaceMember } from "../entities/workspace-member.entity";
import { WorkspaceMemberModel } from "../models/workspace-member.model";
import { WorkspaceMemberRepository } from "./workspace-member-repository.interface";

@Injectable()
export class WorkspaceMemberSqlRepository
    extends SqlRepository<WorkspaceMember>
    implements WorkspaceMemberRepository
{
    constructor(
        @InjectModel(WorkspaceMemberModel)
        private readonly workspaceMemberModel: ModelCtor<WorkspaceMemberModel>,
    ) {
        super(workspaceMemberModel);
    }
}
