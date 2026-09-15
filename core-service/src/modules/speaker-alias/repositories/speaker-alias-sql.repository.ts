import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { SpeakerAlias } from "../entities/speaker-alias.entity";
import { SpeakerAliasModel } from "../models/speaker-alias.model";
import { SpeakerAliasRepository } from "./speaker-alias-repository.interface";

@Injectable()
export class SpeakerAliasSqlRepository
    extends SqlRepository<SpeakerAlias>
    implements SpeakerAliasRepository
{
    constructor(
        @InjectModel(SpeakerAliasModel)
        private readonly speakerAliasModel: ModelCtor<SpeakerAliasModel>,
    ) {
        super(speakerAliasModel);
    }
}
