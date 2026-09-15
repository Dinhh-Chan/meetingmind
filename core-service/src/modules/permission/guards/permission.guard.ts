import { RequestAuthData } from "@common/constant/class/request-auth-data";
import { ApiError } from "@config/exception/api-error";
import { SystemRole } from "@module/user/common/constant";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { Permission } from "../common/constant";
import {
    PERMISSION_METADATA,
    SCOPE_PARAM_METADATA,
} from "../common/decorator";
import { resolveWorkspaceContext } from "../common/workspace-context";
import { PermissionService } from "../services/permission.service";

/**
 * Kiểm tra quyền theo vai trò trong workspace/project/meeting.
 *
 * Route không khai `@RequirePermission` thì guard bỏ qua — dùng cho các route
 * không thuộc phạm vi workspace như đăng nhập hay healthcheck.
 *
 * `SUPER_ADMIN` **không** được đi vòng qua guard này: đó là quyền quản trị
 * nền tảng, không phải quyền đọc nội dung khách hàng (ma trận mục 9).
 */
@Injectable()
export class PermissionGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly permissionService: PermissionService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const permission =
            this.reflector.get<Permission>(
                PERMISSION_METADATA,
                context.getHandler(),
            ) ??
            this.reflector.get<Permission>(
                PERMISSION_METADATA,
                context.getClass(),
            );

        if (!permission) {
            return true;
        }

        const req = context.switchToHttp().getRequest<Request>();
        const requestAuth = req.user;
        if (!(requestAuth instanceof RequestAuthData)) {
            throw ApiError.Unauthorized("error-unauthorized");
        }
        const user = await requestAuth.getUser();
        if (!user) {
            throw ApiError.Unauthorized("error-unauthorized");
        }

        const scope = resolveWorkspaceContext(req);
        if (scope) {
            const scopeParam =
                this.reflector.get<"projectId" | "meetingId">(
                    SCOPE_PARAM_METADATA,
                    context.getHandler(),
                ) ??
                this.reflector.get<"projectId" | "meetingId">(
                    SCOPE_PARAM_METADATA,
                    context.getClass(),
                );
            const id = (req.params as Record<string, string>)?.id;
            if (scopeParam && id) {
                scope[scopeParam] = id;
            }
        }
        if (!scope) {
            // Không xác định được workspace thì không thể xét quyền.
            throw ApiError.Forbidden("error-forbidden");
        }

        const allowed = await this.permissionService.can(
            user._id,
            scope.workspaceId,
            permission,
            { projectId: scope.projectId, meetingId: scope.meetingId },
        );
        if (!allowed) {
            throw ApiError.Forbidden("error-forbidden");
        }

        // Ghi lại phạm vi để service dùng tiếp cho các điều kiện về bản ghi.
        (req as any).workspaceScope = scope;
        (req as any).systemRole = user.systemRole as SystemRole;
        return true;
    }
}
