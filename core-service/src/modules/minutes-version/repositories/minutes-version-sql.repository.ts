import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { MinutesVersion } from "../entities/minutes-version.entity";
import { MinutesVersionModel } from "../models/minutes-version.model";
import { MinutesVersionRepository } from "./minutes-version-repository.interface";

@Injectable()
export class MinutesVersionSqlRepository
    extends SqlRepository<MinutesVersion>
    implements MinutesVersionRepository
{
    constructor(
        @InjectModel(MinutesVersionModel)
        private readonly minutesVersionModel: ModelCtor<MinutesVersionModel>,
    ) {
        super(minutesVersionModel);
    }
}
