import { OmitType } from "@nestjs/swagger";
import { Workspace } from "../entities/workspace.entity";

/** Chủ sở hữu luôn là người tạo, không nhận từ client. */
export class CreateWorkspaceDto extends OmitType(Workspace, [
    "_id",
    "ownerId",
] as const) {}
