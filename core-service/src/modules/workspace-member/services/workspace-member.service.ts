import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { WorkspaceMember } from "../entities/workspace-member.entity";
import { WorkspaceMemberRepository } from "../repositories/workspace-member-repository.interface";

@Injectable()
export class WorkspaceMemberService extends BaseService<WorkspaceMember, WorkspaceMemberRepository> {
    constructor(
        @InjectRepository(Entity.WORKSPACE_MEMBER)
        private readonly workspaceMemberRepository: WorkspaceMemberRepository,
    ) {
        super(workspaceMemberRepository);
    }
}
