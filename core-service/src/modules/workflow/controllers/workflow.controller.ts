import { Authorization, ReqUser } from "@common/decorator/auth.decorator";
import {
    ActionItemPriority,
    ActionItemStatus,
} from "@module/action-item/common/constant";
import { MeetingAccessScope, MeetingSourceType } from "@module/meeting/common/constant";
import { NoteType, NoteVisibility } from "@module/note/common/constant";
import { User } from "@module/user/entities/user.entity";
import { WorkspaceMemberRole } from "@module/workspace-member/common/constant";
import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsArray,
    IsDateString,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    ValidateIf,
    ValidateNested,
} from "class-validator";
import { MeetingBotService } from "@module/meeting-bot/services/meeting-bot.service";
import { WorkflowService } from "../services/workflow.service";

/* ----------------------------------------------------------------- DTO */

class AgendaInputDto {
    @IsString()
    title: string;

    @IsOptional()
    @IsInt()
    plannedMinutes?: number;
}

export class CreateMeetingBodyDto {
    @IsString()
    workspaceId: string;

    @IsOptional()
    @IsString()
    projectId?: string;

    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsEnum(MeetingSourceType)
    sourceType: MeetingSourceType;

    @IsOptional()
    @IsString()
    meetingUrl?: string;

    @IsOptional()
    @IsEnum(MeetingAccessScope)
    accessScope?: MeetingAccessScope;

    @IsOptional()
    @IsDateString()
    scheduledStartAt?: string;

    @IsOptional()
    @IsInt()
    durationMin?: number;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AgendaInputDto)
    agenda?: AgendaInputDto[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    participantIds?: string[];
}

export class ReviewEditBodyDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    assigneeId?: string | null;

    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsDateString()
    deadline?: string | null;

    @IsOptional()
    @IsEnum(ActionItemPriority)
    priority?: ActionItemPriority;
}

export class RejectBodyDto {
    @IsOptional()
    @IsString()
    reason?: string;
}

export class TaskPatchBodyDto extends ReviewEditBodyDto {
    @IsOptional()
    @IsEnum(ActionItemStatus)
    status?: ActionItemStatus;

    @IsOptional()
    @IsString()
    blockedReason?: string;
}

export class CommentBodyDto {
    @IsString()
    body: string;
}

export class NoteBodyDto {
    @IsString()
    body: string;

    @IsOptional()
    @IsEnum(NoteType)
    type?: NoteType;

    @IsOptional()
    @IsEnum(NoteVisibility)
    visibility?: NoteVisibility;

    @IsOptional()
    @IsInt()
    recordingMs?: number;
}

export class SpeakerBodyDto {
    @IsString()
    speakerLabel: string;

    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    userId: string | null;
}

export class InviteBodyDto {
    @IsString()
    workspaceId: string;

    @IsString()
    identifier: string;

    @IsEnum(WorkspaceMemberRole)
    role: WorkspaceMemberRole;
}

/* ---------------------------------------------------------- controller */

/**
 * Thao tác nghiệp vụ. Không gắn `@RequirePermission`: mỗi route cần điều kiện
 * theo bản ghi (người tạo, người được giao, chủ ghi chú) nên service tự kiểm
 * tra qua `PermissionService`.
 */
@Controller("workflow")
@ApiTags("workflow")
@Authorization()
export class WorkflowController {
    constructor(
        private readonly workflowService: WorkflowService,
        private readonly meetingBotService: MeetingBotService,
    ) {}

    /* bot ghi âm Google Meet */

    @Get("meetings/:id/bot")
    getBot(@ReqUser() user: User, @Param("id") id: string) {
        return this.meetingBotService.getBot(user._id, id);
    }

    @Post("meetings/:id/bot")
    inviteBot(@ReqUser() user: User, @Param("id") id: string) {
        return this.meetingBotService.invite(user._id, id);
    }

    @Post("meetings/:id/bot/stop")
    stopBot(@ReqUser() user: User, @Param("id") id: string) {
        return this.meetingBotService.stop(user._id, id);
    }

    @Post("meetings")
    createMeeting(@ReqUser() user: User, @Body() dto: CreateMeetingBodyDto) {
        return this.workflowService.createMeeting(user._id, dto);
    }

    @Get("meetings/:id/info")
    getMeetingInfo(@ReqUser() user: User, @Param("id") id: string) {
        return this.workflowService.getMeetingInfo(user._id, id);
    }

    /* biên bản */

    @Post("meetings/:id/minutes/submit")
    submitMinutes(@ReqUser() user: User, @Param("id") id: string) {
        return this.workflowService.submitMinutes(user._id, id);
    }

    @Post("meetings/:id/minutes/approve")
    approveMinutes(@ReqUser() user: User, @Param("id") id: string) {
        return this.workflowService.approveMinutes(user._id, id);
    }

    @Post("meetings/:id/minutes/reject")
    rejectMinutes(
        @ReqUser() user: User,
        @Param("id") id: string,
        @Body() dto: RejectBodyDto,
    ) {
        return this.workflowService.rejectMinutes(user._id, id, dto.reason);
    }

    @Post("meetings/:id/minutes/new-draft")
    newMinutesDraft(@ReqUser() user: User, @Param("id") id: string) {
        return this.workflowService.newMinutesDraft(user._id, id);
    }

    /* đề xuất AI */

    @Put("review-items/:id")
    editReview(@ReqUser() user: User, @Param("id") id: string, @Body() dto: ReviewEditBodyDto) {
        return this.workflowService.editReview(user._id, id, { ...dto });
    }

    @Post("review-items/:id/approve")
    approveReview(@ReqUser() user: User, @Param("id") id: string, @Body() dto: ReviewEditBodyDto) {
        return this.workflowService.approveReview(user._id, id, dto);
    }

    @Post("review-items/:id/reject")
    rejectReview(@ReqUser() user: User, @Param("id") id: string, @Body() dto: RejectBodyDto) {
        return this.workflowService.rejectReview(user._id, id, dto.reason);
    }

    /* task */

    @Put("tasks/:id")
    updateTask(@ReqUser() user: User, @Param("id") id: string, @Body() dto: TaskPatchBodyDto) {
        return this.workflowService.updateTask(user._id, id, dto);
    }

    @Get("tasks/:id/comments")
    getTaskComments(@ReqUser() user: User, @Param("id") id: string) {
        return this.workflowService.getTaskComments(user._id, id);
    }

    @Post("tasks/:id/comments")
    addTaskComment(@ReqUser() user: User, @Param("id") id: string, @Body() dto: CommentBodyDto) {
        return this.workflowService.addTaskComment(user._id, id, dto.body);
    }

    /* ghi chú */

    @Get("meetings/:id/notes")
    getNotes(@ReqUser() user: User, @Param("id") id: string) {
        return this.workflowService.getNotes(user._id, id);
    }

    @Post("meetings/:id/notes")
    addNote(@ReqUser() user: User, @Param("id") id: string, @Body() dto: NoteBodyDto) {
        return this.workflowService.addNote(user._id, id, dto);
    }

    @Post("notes/:id/toggle-minutes")
    toggleNoteInMinutes(@ReqUser() user: User, @Param("id") id: string) {
        return this.workflowService.toggleNoteInMinutes(user._id, id);
    }

    /* người nói */

    @Post("meetings/:id/speakers")
    assignSpeaker(@ReqUser() user: User, @Param("id") id: string, @Body() dto: SpeakerBodyDto) {
        return this.workflowService.assignSpeaker(user._id, id, dto.speakerLabel, dto.userId ?? null);
    }

    /** Phân tích lại transcript hiện tại (sau khi gán tên người nói). */
    @Post("meetings/:id/reanalyze")
    reanalyze(@ReqUser() user: User, @Param("id") id: string) {
        return this.workflowService.reanalyze(user._id, id);
    }

    /* thành viên */

    @Post("invites/accept")
    acceptInvite(@ReqUser() user: User, @Body("token") token: string) {
        return this.workflowService.acceptInvite(user._id, token);
    }

    @Post("members/invite")
    inviteMember(@ReqUser() user: User, @Body() dto: InviteBodyDto) {
        return this.workflowService.inviteMember(user._id, dto.workspaceId, dto.identifier, dto.role);
    }
}
