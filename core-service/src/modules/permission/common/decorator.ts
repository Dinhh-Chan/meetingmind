import { SetMetadata } from "@nestjs/common";
import { Permission } from "./constant";

export const PERMISSION_METADATA = "required-permission";

/**
 * Khai báo quyền cần có để gọi route.
 *
 * Guard chỉ giải quyết được các quyền xét theo vai trò. Những ô "có điều kiện"
 * trong ma trận (cuộc họp mình tạo, task được giao cho mình) phải kiểm tra
 * tiếp trong service bằng `PermissionService.assertOnMeeting/assertOnTask`,
 * vì lúc guard chạy thì chưa biết bản ghi nào.
 */
export const RequirePermission = (permission: Permission) =>
    SetMetadata(PERMISSION_METADATA, permission);

export const SCOPE_PARAM_METADATA = "scope-param";

/**
 * Khai `:id` của route là `projectId` hay `meetingId`, để guard tra được
 * vai trò trong phạm vi đó mà không phải load bản ghi trước.
 */
export const ScopeParam = (key: "projectId" | "meetingId") =>
    SetMetadata(SCOPE_PARAM_METADATA, key);
