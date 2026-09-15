import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { ProjectMember } from "../entities/project-member.entity";
import { ProjectMemberModel } from "../models/project-member.model";
import { ProjectMemberRepository } from "./project-member-repository.interface";

@Injectable()
export class ProjectMemberSqlRepository
    extends SqlRepository<ProjectMember>
    implements ProjectMemberRepository
{
    constructor(
        @InjectModel(ProjectMemberModel)
        private readonly projectMemberModel: ModelCtor<ProjectMemberModel>,
    ) {
        super(projectMemberModel);
    }
}
