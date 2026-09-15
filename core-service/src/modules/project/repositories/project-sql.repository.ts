import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { Project } from "../entities/project.entity";
import { ProjectModel } from "../models/project.model";
import { ProjectRepository } from "./project-repository.interface";

@Injectable()
export class ProjectSqlRepository
    extends SqlRepository<Project>
    implements ProjectRepository
{
    constructor(
        @InjectModel(ProjectModel)
        private readonly projectModel: ModelCtor<ProjectModel>,
    ) {
        super(projectModel);
    }
}
