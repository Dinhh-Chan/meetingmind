import { PartialType } from "@nestjs/swagger";
import { CreateUploadSessionDto } from "./create-upload-session.dto";

export class UpdateUploadSessionDto extends PartialType(CreateUploadSessionDto) {}
