import { OmitType } from "@nestjs/swagger";
import { MediaFile } from "../entities/media-file.entity";

export class CreateMediaFileDto extends OmitType(MediaFile, ["_id"] as const) {}
