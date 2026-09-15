import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { Project } from "../entities/project.entity";
import { ProjectRepository } from "../repositories/project-repository.interface";

@Injectable()
export class ProjectService extends BaseService<Project, ProjectRepository> {
    constructor(
        @InjectRepository(Entity.PROJECT)
        private readonly projectRepository: ProjectRepository,
    ) {
        super(projectRepository);
    }
}
