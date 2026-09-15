import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { TranscriptVersion } from "../entities/transcript-version.entity";
import { TranscriptVersionModel } from "../models/transcript-version.model";
import { TranscriptVersionRepository } from "./transcript-version-repository.interface";

@Injectable()
export class TranscriptVersionSqlRepository
    extends SqlRepository<TranscriptVersion>
    implements TranscriptVersionRepository
{
    constructor(
        @InjectModel(TranscriptVersionModel)
        private readonly transcriptVersionModel: ModelCtor<TranscriptVersionModel>,
    ) {
        super(transcriptVersionModel);
    }
}
