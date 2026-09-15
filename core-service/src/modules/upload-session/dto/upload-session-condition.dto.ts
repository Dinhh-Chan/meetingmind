import { PartialType } from "@nestjs/swagger";
import { UploadSession } from "../entities/upload-session.entity";

export class UploadSessionConditionDto extends PartialType(UploadSession) {}
