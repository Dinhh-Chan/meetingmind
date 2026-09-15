import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { ProjectMember } from "../entities/project-member.entity";
import { ProjectMemberRepository } from "../repositories/project-member-repository.interface";

@Injectable()
export class ProjectMemberService extends BaseService<ProjectMember, ProjectMemberRepository> {
    constructor(
        @InjectRepository(Entity.PROJECT_MEMBER)
        private readonly projectMemberRepository: ProjectMemberRepository,
    ) {
        super(projectMemberRepository);
    }
}
