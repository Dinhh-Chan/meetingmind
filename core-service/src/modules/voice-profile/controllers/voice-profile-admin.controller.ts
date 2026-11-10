import { Authorization, ReqUser } from "@common/decorator/auth.decorator";
import { ApiError } from "@config/exception/api-error";
import { ActivityType } from "@module/activity-log/common/constant";
import { ActivityLogService } from "@module/activity-log/services/activity-log.service";
import { Permission } from "@module/permission/common/constant";
import { PermissionService } from "@module/permission/services/permission.service";
import { User } from "@module/user/entities/user.entity";
import { UserService } from "@module/user/service/user.service";
import { WorkspaceMemberService } from "@module/workspace-member/services/workspace-member.service";
import { Body, Controller, Delete, Get, Param, Post, Query, Res } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsString } from "class-validator";
import { Response } from "express";
import { VoiceProfileService } from "../services/voice-profile.service";

export class VoiceReviewBodyDto {
    @IsString()
    workspaceId: string;

    @IsBoolean()
    approve: boolean;
}

/**
 * Admin workspace xem, nghe và xác nhận mẫu giọng của thành viên (Cài đặt ›
 * Mẫu giọng). Chỉ mẫu đã xác nhận mới dùng để gợi ý tên người nói.
 */
@Controller("voice-profiles")
@ApiTags("voice-profiles")
@Authorization()
export class VoiceProfileAdminController {
    constructor(
        private readonly voiceProfileService: VoiceProfileService,
        private readonly permissionService: PermissionService,
        private readonly workspaceMemberService: WorkspaceMemberService,
        private readonly userService: UserService,
        private readonly activityLogService: ActivityLogService,
    ) {}

    /** Người quản lý thành viên của workspace, và người kia là thành viên workspace đó. */
    private async assertManages(userId: string, workspaceId: string, targetId?: string) {
        await this.permissionService.assert(userId, workspaceId, Permission.WORKSPACE_MEMBER_MANAGE);
        if (targetId) {
            const member = await this.workspaceMemberService.getOne(null, { workspaceId, userId: targetId });
            if (!member) throw ApiError.NotFound("error-voice-not-found");
        }
    }

    @Get()
    async list(@ReqUser() user: User, @Query("workspaceId") workspaceId: string) {
        await this.assertManages(user._id, workspaceId);
        const members = await this.workspaceMemberService.getMany(null, { workspaceId });
        return this.voiceProfileService.listFor(members.map((m) => m.userId));
    }

    @Post(":userId/review")
    async review(@ReqUser() user: User, @Param("userId") userId: string, @Body() dto: VoiceReviewBodyDto) {
        await this.assertManages(user._id, dto.workspaceId, userId);
        const result = await this.voiceProfileService.review(userId, dto.approve, user._id);
        const [target] = await this.userService.getMany(null, { _id: userId }, { enableDataPartition: false } as any);
        await this.activityLogService.record({
            workspaceId: dto.workspaceId,
            actorId: user._id,
            type: ActivityType.VOICE_REVIEWED,
            target: `${target?.fullname || target?.username || userId}: ${dto.approve ? "Xác nhận" : "Từ chối"}`,
        });
        return result;
    }

    @Get(":userId/samples/:index")
    async sample(
        @ReqUser() user: User,
        @Param("userId") userId: string,
        @Param("index") index: string,
        @Query("workspaceId") workspaceId: string,
        @Res() res: Response,
    ) {
        await this.assertManages(user._id, workspaceId, userId);
        const { stream, mimetype } = await this.voiceProfileService.sample(userId, Number(index));
        res.setHeader("Content-Type", mimetype);
        stream.pipe(res);
    }

    @Delete(":userId")
    async remove(@ReqUser() user: User, @Param("userId") userId: string, @Query("workspaceId") workspaceId: string) {
        await this.assertManages(user._id, workspaceId, userId);
        return this.voiceProfileService.remove(userId);
    }
}
