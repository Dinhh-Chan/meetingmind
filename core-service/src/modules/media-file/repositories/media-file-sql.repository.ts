import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { MediaFile } from "../entities/media-file.entity";
import { MediaFileModel } from "../models/media-file.model";
import { MediaFileRepository } from "./media-file-repository.interface";

@Injectable()
export class MediaFileSqlRepository
    extends SqlRepository<MediaFile>
    implements MediaFileRepository
{
    constructor(
        @InjectModel(MediaFileModel)
        private readonly mediaFileModel: ModelCtor<MediaFileModel>,
    ) {
        super(mediaFileModel);
    }
}
