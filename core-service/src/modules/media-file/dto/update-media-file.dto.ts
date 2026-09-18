import { PartialType } from "@nestjs/swagger";
import { CreateMediaFileDto } from "./create-media-file.dto";

export class UpdateMediaFileDto extends PartialType(CreateMediaFileDto) {}
