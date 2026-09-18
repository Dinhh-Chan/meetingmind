import { PartialType } from "@nestjs/swagger";
import { MediaFile } from "../entities/media-file.entity";

export class MediaFileConditionDto extends PartialType(MediaFile) {}
