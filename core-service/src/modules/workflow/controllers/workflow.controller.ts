import { Authorization, ReqUser } from "@common/decorator/auth.decorator";
import {
    ActionItemPriority,
    ActionItemStatus,
} from "@module/action-item/common/constant";
import { MeetingAccessScope, MeetingSourceType } from "@module/meeting/common/constant";
import { NoteType, NoteVisibility } from "@module/note/common/constant";
import {
    ProjectDiscipline,
    ProjectMemberRole,
} from "@module/project-member/common/constant";
import { User } from "@module/user/entities/user.entity";
import { WorkspaceMemberRole } from "@module/workspace-member/common/constant";
import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from "@nestjs/common";
import { Response } from "express";
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

    /** Người ghi âm chính (thư ký), phải nằm trong danh sách tham dự. */
    @IsOptional()
    @IsString()
    recorderId?: string;

    /** Người duyệt biên bản và đề xuất AI, phải nằm trong danh sách tham dự. */
    @IsOptional()
    @IsString()
    approverId?: string;
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

    /** Người duyệt task; bỏ trống thì là người bấm Duyệt đề xuất. */
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    approverId?: string | null;
}

export class ProjectMemberBodyDto {
    @IsString()
    userId: string;

    @IsEnum(ProjectMemberRole)
    role: ProjectMemberRole;

    @IsOptional()
    @IsEnum(ProjectDiscipline)
    discipline?: ProjectDiscipline | null;
}

export class ProjectMemberPatchDto {
    @IsOptional()
    @IsEnum(ProjectMemberRole)
    role?: ProjectMemberRole;

    /** null: bỏ vai trò chuyên môn. */
    @IsOptional()
    @IsEnum(ProjectDiscipline)
    discipline?: ProjectDiscipline | null;
}

export class RejectBodyDto {
    @IsOptional()
    @IsString()
    reason?: string;

    /** Phiên bản biên bản; bỏ trống thì là bản người này đang xem. */
    @IsOptional()
    @IsString()
    versionId?: string;
}

export class MinutesTargetBodyDto {
    @IsOptional()
    @IsString()
    versionId?: string;
}

export class MinutesEditBodyDto extends MinutesTargetBodyDto {
    @IsOptional()
    @IsString()
    summary?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    decisions?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    openIssues?: string[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MinutesSectionDto)
    sections?: MinutesSectionDto[];
}

export class TranscriptTargetBodyDto {
    /** Bản ghi (phiên bản transcript); bỏ trống thì là bản người này đang xem. */
    @IsOptional()
    @IsString()
    transcriptVersionId?: string;
}

export class RecorderBodyDto {
    @IsOptional()
    @ValidateIf((_, v) => v !== null)
    @IsString()
    userId: string | null;
}

export class TaskPatchBodyDto extends ReviewEditBodyDto {
    @IsOptional()
    @IsEnum(ActionItemStatus)
    status?: ActionItemStatus;

    @IsOptional()
    @IsString()
    blockedReason?: string;
}

export class ClarifyBodyDto {
    @IsString()
    recipientId: string;

    @IsString()
    question: string;
}

export class AnswerBodyDto {
    @IsString()
    answer: string;
}

export class TemplateBodyDto {
    @IsOptional()
    @IsString()
    workspaceId?: string;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    sections?: string[];

    /** Dự án dùng mẫu này; bỏ trống thì không đổi. */
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    projectIds?: string[];
}

export class MinutesSectionDto {
    @IsString()
    title: string;

    @IsString()
    content: string;
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

export class SpeakerBodyDto extends TranscriptTargetBodyDto {
    @IsString()
    speakerLabel: string;

    /** Tên tự nhập khi người nói không có tài khoản trong dự án. */
    @IsOptional()
    @IsString()
    guestName?: string;

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

    /** Transcript, biên bản, đề xuất của bản ghi người này xem được (`?record=` để chọn bản). */
    @Get("meetings/:id/content")
    getMeetingContent(
        @ReqUser() user: User,
        @Param("id") id: string,
        @Query("record") record?: string,
    ) {
        return this.workflowService.getMeetingContent(user._id, id, record || undefined);
    }

    /** Chạy lại bước xử lý bị lỗi của bản ghi, không phải tải tệp lại. */
    @Post("meetings/:id/retry")
    retryProcessing(@ReqUser() user: User, @Param("id") id: string) {
        return this.workflowService.retryProcessing(user._id, id);
    }

    /** Âm thanh của bản ghi đang mở (`?record=`), để nghe lại trong tab Transcript. */
    @Get("meetings/:id/audio")
    async recordAudio(
        @ReqUser() user: User,
        @Param("id") id: string,
        @Query("record") record: string | undefined,
        @Res() res: Response,
    ) {
        const { stream, size, mimetype } = await this.workflowService.recordAudio(user._id, id, record || undefined);
        res.setHeader("Content-Type", mimetype);
        res.setHeader("Content-Length", String(size));
        stream.pipe(res);
    }

    /** Chỉ định người ghi âm chính (thư ký) của cuộc họp. */
    @Put("meetings/:id/recorder")
    setMeetingRecorder(@ReqUser() user: User, @Param("id") id: string, @Body() dto: RecorderBodyDto) {
        return this.workflowService.setMeetingRecorder(user._id, id, dto.userId ?? null);
    }

    /** Chỉ định người duyệt biên bản và đề xuất AI của cuộc họp. */
    @Put("meetings/:id/approver")
    setMeetingApprover(@ReqUser() user: User, @Param("id") id: string, @Body() dto: RecorderBodyDto) {
        return this.workflowService.setMeetingApprover(user._id, id, dto.userId ?? null);
    }

    /* biên bản */

    @Post("meetings/:id/minutes/submit")
    submitMinutes(@ReqUser() user: User, @Param("id") id: string, @Body() dto: MinutesTargetBodyDto) {
        return this.workflowService.submitMinutes(user._id, id, dto.versionId);
    }

    /** Người ghi sửa biên bản nháp của mình. */
    @Put("meetings/:id/minutes")
    updateMinutes(@ReqUser() user: User, @Param("id") id: string, @Body() dto: MinutesEditBodyDto) {
        return this.workflowService.updateMinutes(user._id, id, {
            minutesVersionId: dto.versionId,
            summary: dto.summary,
            decisions: dto.decisions,
            openIssues: dto.openIssues,
            sections: dto.sections,
        });
    }

    @Post("meetings/:id/minutes/approve")
    approveMinutes(@ReqUser() user: User, @Param("id") id: string, @Body() dto: MinutesTargetBodyDto) {
        return this.workflowService.approveMinutes(user._id, id, dto.versionId);
    }

    @Post("meetings/:id/minutes/reject")
    rejectMinutes(
        @ReqUser() user: User,
        @Param("id") id: string,
        @Body() dto: RejectBodyDto,
    ) {
        return this.workflowService.rejectMinutes(user._id, id, dto.reason, dto.versionId);
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

    /* mẫu biên bản */

    @Get("minutes-templates")
    listMinutesTemplates(@ReqUser() user: User, @Query("workspaceId") workspaceId: string) {
        return this.workflowService.listMinutesTemplates(user._id, workspaceId);
    }

    @Post("minutes-templates")
    createMinutesTemplate(@ReqUser() user: User, @Body() dto: TemplateBodyDto) {
        return this.workflowService.createMinutesTemplate(user._id, {
            workspaceId: dto.workspaceId,
            name: dto.name,
            sections: dto.sections,
            projectIds: dto.projectIds,
        });
    }

    @Put("minutes-templates/:id")
    updateMinutesTemplate(@ReqUser() user: User, @Param("id") id: string, @Body() dto: TemplateBodyDto) {
        return this.workflowService.updateMinutesTemplate(user._id, id, dto);
    }

    @Post("minutes-templates/:id/duplicate")
    duplicateMinutesTemplate(@ReqUser() user: User, @Param("id") id: string) {
        return this.workflowService.duplicateMinutesTemplate(user._id, id);
    }

    @Delete("minutes-templates/:id")
    deleteMinutesTemplate(@ReqUser() user: User, @Param("id") id: string) {
        return this.workflowService.deleteMinutesTemplate(user._id, id);
    }

    /* tích hợp */

    @Get("integrations")
    getIntegrations(@ReqUser() user: User, @Query("workspaceId") workspaceId: string) {
        return this.workflowService.getIntegrations(user._id, workspaceId);
    }

    /* nhật ký hoạt động */

    @Get("activity")
    listActivity(
        @ReqUser() user: User,
        @Query("workspaceId") workspaceId: string,
        @Query("type") type?: string,
    ) {
        return this.workflowService.listActivity(user._id, workspaceId, type || undefined);
    }

    /* làm rõ đề xuất */

    @Post("review-items/:id/clarify")
    requestClarification(@ReqUser() user: User, @Param("id") id: string, @Body() dto: ClarifyBodyDto) {
        return this.workflowService.requestClarification(user._id, id, dto);
    }

    @Get("clarifications")
    listClarifications(@ReqUser() user: User, @Query("workspaceId") workspaceId: string) {
        return this.workflowService.listClarifications(user._id, workspaceId);
    }

    @Post("clarifications/:id/answer")
    answerClarification(@ReqUser() user: User, @Param("id") id: string, @Body() dto: AnswerBodyDto) {
        return this.workflowService.answerClarification(user._id, id, dto.answer);
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
        return this.workflowService.assignSpeaker(
            user._id,
            id,
            dto.speakerLabel,
            dto.userId ?? null,
            dto.transcriptVersionId,
            dto.guestName,
        );
    }

    /** Phân tích lại một bản ghi (sau khi gán tên người nói). */
    @Post("meetings/:id/reanalyze")
    reanalyze(@ReqUser() user: User, @Param("id") id: string, @Body() dto: TranscriptTargetBodyDto) {
        return this.workflowService.reanalyze(user._id, id, dto.transcriptVersionId);
    }

    /* thành viên */

    @Post("projects/:id/members")
    addProjectMember(@ReqUser() user: User, @Param("id") id: string, @Body() dto: ProjectMemberBodyDto) {
        return this.workflowService.addProjectMember(user._id, id, dto);
    }

    /** Người tạo dự án đổi quyền / vai trò chuyên môn của thành viên. */
    @Put("projects/:id/members/:userId")
    updateProjectMember(
        @ReqUser() user: User,
        @Param("id") id: string,
        @Param("userId") memberUserId: string,
        @Body() dto: ProjectMemberPatchDto,
    ) {
        return this.workflowService.updateProjectMember(user._id, id, memberUserId, dto);
    }

    /** Người tạo dự án xoá thành viên khỏi dự án. */
    @Delete("projects/:id/members/:userId")
    removeProjectMember(@ReqUser() user: User, @Param("id") id: string, @Param("userId") memberUserId: string) {
        return this.workflowService.removeProjectMember(user._id, id, memberUserId);
    }

    @Post("invites/accept")
    acceptInvite(@ReqUser() user: User, @Body("token") token: string) {
        return this.workflowService.acceptInvite(user._id, token);
    }

    @Post("members/invite")
    inviteMember(@ReqUser() user: User, @Body() dto: InviteBodyDto) {
        return this.workflowService.inviteMember(user._id, dto.workspaceId, dto.identifier, dto.role);
    }
}
