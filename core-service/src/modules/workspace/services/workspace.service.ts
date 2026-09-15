import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import {
    WorkspaceMemberRole,
    WorkspaceMemberStatus,
} from "@module/workspace-member/common/constant";
import { WorkspaceMemberService } from "@module/workspace-member/services/workspace-member.service";
import { User } from "@module/user/entities/user.entity";
import { Injectable } from "@nestjs/common";
import { Workspace } from "../entities/workspace.entity";
import { WorkspaceRepository } from "../repositories/workspace-repository.interface";

@Injectable()
export class WorkspaceService extends BaseService<Workspace, WorkspaceRepository> {
    constructor(
        @InjectRepository(Entity.WORKSPACE)
        private readonly workspaceRepository: WorkspaceRepository,
        private readonly workspaceMemberService: WorkspaceMemberService,
    ) {
        super(workspaceRepository);
    }

    /**
     * Tạo workspace kèm membership OWNER cho người tạo.
     *
     * Không có bước này thì không ai có quyền trong workspace vừa tạo, kể cả
     * người tạo ra nó — mọi thao tác quản trị sau đó đều bị chặn.
     * Ma trận phân quyền: "Mỗi workspace có một Owner đang hoạt động".
     */
    async create(user: User, dto: Partial<Workspace>) {
        const ownerId = dto.ownerId || user?._id;
        const workspace = await super.create(user, { ...dto, ownerId });

        await this.workspaceMemberService.create(user, {
            workspaceId: workspace._id,
            userId: ownerId,
            role: WorkspaceMemberRole.OWNER,
            status: WorkspaceMemberStatus.ACTIVE,
            joinedAt: new Date(),
        });

        return workspace;
    }
}
