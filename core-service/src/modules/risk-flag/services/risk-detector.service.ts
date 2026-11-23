import { ApiError } from "@config/exception/api-error";
import { ActionItemService } from "@module/action-item/services/action-item.service";
import { Permission } from "@module/permission/common/constant";
import { PermissionService } from "@module/permission/services/permission.service";
import { TaskDependencyService } from "@module/task-dependency/services/task-dependency.service";
import { UserService } from "@module/user/service/user.service";
import { WorkspaceService } from "@module/workspace/services/workspace.service";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { RiskStatus } from "../common/constant";
import { RiskFlag } from "../entities/risk-flag.entity";
import { RiskFlagService } from "./risk-flag.service";
import { detectRisks, vnDay } from "./risk-rules";

/**
 * Chạy quy tắc trên task của workspace và ghi vào risk_flags: cảnh báo mới thì mở,
 * cảnh báo cũ còn đúng thì giữ trạng thái (kể cả đã "bỏ qua"), hết đúng thì đóng.
 */
@Injectable()
export class RiskDetectorService {
    private readonly logger = new Logger(RiskDetectorService.name);

    constructor(
        private readonly riskFlagService: RiskFlagService,
        private readonly actionItemService: ActionItemService,
        private readonly taskDependencyService: TaskDependencyService,
        private readonly userService: UserService,
        private readonly workspaceService: WorkspaceService,
        private readonly permissionService: PermissionService,
    ) {}

    async detect(workspaceId: string) {
        const [tasks, dependencies, existing] = await Promise.all([
            this.actionItemService.getMany(null, { workspaceId, deletedAt: null }),
            this.taskDependencyService.getMany(null, { workspaceId }),
            this.riskFlagService.getMany(null, { workspaceId }),
        ]);
        const names = new Map<string, string>();
        const ids = [...new Set(tasks.map((t) => t.assigneeId).filter(Boolean))] as string[];
        if (ids.length) {
            const users = await this.userService.getMany(null, { _id: { $in: ids } }, { enableDataPartition: false });
            users.forEach((u) => names.set(u._id, u.fullname || u.username));
        }
        const found = detectRisks(tasks, dependencies, vnDay(Date.now()), (id) => names.get(id) ?? "Một thành viên");
        const byKey = new Map(existing.map((f) => [f.dedupKey, f]));
        const now = new Date();
        for (const risk of found) {
            const old = byKey.get(risk.dedupKey);
            if (!old) {
                await this.riskFlagService.create(null, { ...risk, status: RiskStatus.OPEN, detectedAt: now } as never);
            } else {
                // Đã đóng mà lại đúng: mở lại. Đã bỏ qua: giữ nguyên, chỉ cập nhật số liệu.
                const status = old.status === RiskStatus.RESOLVED ? RiskStatus.OPEN : old.status;
                await this.riskFlagService.updateById(null, old._id, {
                    title: risk.title,
                    description: risk.description,
                    severity: risk.severity,
                    evidence: { ...risk.evidence, ...(old.evidence?.ackReason ? { ackReason: old.evidence.ackReason } : {}) },
                    status,
                    ...(status === RiskStatus.OPEN && old.status === RiskStatus.RESOLVED ? { detectedAt: now, resolvedAt: null } : {}),
                } as never);
            }
        }
        const live = new Set(found.map((r) => r.dedupKey));
        for (const old of existing) {
            if (old.status !== RiskStatus.RESOLVED && !live.has(old.dedupKey)) {
                await this.riskFlagService.updateById(null, old._id, { status: RiskStatus.RESOLVED, resolvedAt: now } as never);
            }
        }
        return found.length;
    }

    /** Quét mọi workspace 15 phút một lần (task quá hạn sang ngày mới mà không ai sửa gì). */
    @Cron("*/15 * * * *")
    async detectAll() {
        const workspaces = await this.workspaceService.getMany(null, { deletedAt: null });
        for (const w of workspaces) {
            try {
                await this.detect(w._id);
            } catch (err) {
                this.logger.warn(`Không quét được rủi ro workspace ${w._id}: ${(err as Error).message}`);
            }
        }
    }

    /** Cảnh báo mình được xem: của task mình xem được; dồn deadline thì của chính mình hoặc mình là Owner/Admin. */
    async listForUser(userId: string, workspaceId: string) {
        await this.permissionService.assert(userId, workspaceId, Permission.WORKSPACE_VIEW);
        await this.detect(workspaceId);
        const flags = await this.riskFlagService.getMany(null, {
            workspaceId,
            status: { $in: [RiskStatus.OPEN, RiskStatus.ACKNOWLEDGED] },
        });
        const tasks = await this.actionItemService.getMany(null, { workspaceId, deletedAt: null });
        const taskOf = new Map(tasks.map((t) => [t._id, t]));
        const admin = await this.permissionService.can(userId, workspaceId, Permission.RISK_RULE_CONFIGURE);
        const visible: RiskFlag[] = [];
        for (const f of flags) {
            const task = f.actionItemId ? taskOf.get(f.actionItemId) : undefined;
            if (task ? await this.permissionService.canOnTask(userId, task, Permission.TASK_VIEW) : f.userId === userId || admin) {
                visible.push(f);
            }
        }
        return visible;
    }

    /** "Bỏ qua": người quản lý xác nhận đã biết, kèm lý do; không hiện lại cho tới khi hết đúng rồi đúng lại. */
    async acknowledge(userId: string, flagId: string, reason: string) {
        const flag = await this.riskFlagService.getById(null, flagId);
        if (!flag) throw ApiError.NotFound("error-risk-not-found");
        await this.permissionService.assert(userId, flag.workspaceId, Permission.RISK_RESOLVE, {
            projectId: flag.projectId ?? undefined,
        });
        return this.riskFlagService.updateById(null, flag._id, {
            status: RiskStatus.ACKNOWLEDGED,
            evidence: { ...(flag.evidence ?? {}), ackReason: reason, ackBy: userId },
        } as never);
    }
}
