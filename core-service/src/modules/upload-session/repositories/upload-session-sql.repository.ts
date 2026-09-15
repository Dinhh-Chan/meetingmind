import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { UploadSession } from "../entities/upload-session.entity";
import { UploadSessionModel } from "../models/upload-session.model";
import { UploadSessionRepository } from "./upload-session-repository.interface";

@Injectable()
export class UploadSessionSqlRepository
    extends SqlRepository<UploadSession>
    implements UploadSessionRepository
{
    constructor(
        @InjectModel(UploadSessionModel)
        private readonly uploadSessionModel: ModelCtor<UploadSessionModel>,
    ) {
        super(uploadSessionModel);
    }
}
