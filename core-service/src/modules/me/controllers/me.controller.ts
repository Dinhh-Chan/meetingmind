import { Authorization, ReqUser } from "@common/decorator/auth.decorator";
import { User } from "@module/user/entities/user.entity";
import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { MeService } from "../services/me.service";

/**
 * Danh sách theo người đang đăng nhập. Không gắn `@RequirePermission`: route
 * nào cần workspace thì service tự kiểm tra membership, vì `/me/workspaces`
 * phải gọi được trước khi biết workspace nào.
 */
@Controller("me")
@ApiTags("me")
@Authorization()
export class MeController {
    constructor(private readonly meService: MeService) {}

    @Get("notifications")
    async getNotifications(
        @ReqUser() user: User,
        @Query("workspaceId") workspaceId: string,
    ) {
        return this.meService.getNotifications(user._id, workspaceId);
    }

    @Post("notifications/seen")
    async markNotificationsSeen(
        @ReqUser() user: User,
        @Body("workspaceId") workspaceId: string,
    ) {
        await this.meService.markNotificationsSeen(user._id, workspaceId);
    }

    @Get("workspaces")
    async getWorkspaces(@ReqUser() user: User) {
        return this.meService.getWorkspaces(user._id);
    }

    @Get("members")
    async getMembers(
        @ReqUser() user: User,
        @Query("workspaceId") workspaceId: string,
    ) {
        return this.meService.getMembers(user._id, workspaceId);
    }

    @Get("projects")
    async getProjects(
        @ReqUser() user: User,
        @Query("workspaceId") workspaceId: string,
    ) {
        return this.meService.getProjects(user._id, workspaceId);
    }

    @Get("tasks")
    async getTasks(
        @ReqUser() user: User,
        @Query("workspaceId") workspaceId: string,
    ) {
        return this.meService.getTasks(user._id, workspaceId);
    }

    @Get("review-items")
    async getReviewItems(
        @ReqUser() user: User,
        @Query("workspaceId") workspaceId: string,
    ) {
        return this.meService.getReviewItems(user._id, workspaceId);
    }

    @Get("meetings")
    @ApiQuery({ name: "projectId", required: false })
    async getMeetings(
        @ReqUser() user: User,
        @Query("workspaceId") workspaceId: string,
        @Query("projectId") projectId?: string,
    ) {
        return this.meService.getMeetings(user._id, workspaceId, projectId);
    }
}
