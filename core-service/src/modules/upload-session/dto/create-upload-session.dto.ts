import { OmitType } from "@nestjs/swagger";
import { UploadSession } from "../entities/upload-session.entity";

export class CreateUploadSessionDto extends OmitType(UploadSession, ["_id"] as const) {}
