import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { TranscriptSegment } from "../entities/transcript-segment.entity";
import { TranscriptSegmentModel } from "../models/transcript-segment.model";
import { TranscriptSegmentRepository } from "./transcript-segment-repository.interface";

@Injectable()
export class TranscriptSegmentSqlRepository
    extends SqlRepository<TranscriptSegment>
    implements TranscriptSegmentRepository
{
    constructor(
        @InjectModel(TranscriptSegmentModel)
        private readonly transcriptSegmentModel: ModelCtor<TranscriptSegmentModel>,
    ) {
        super(transcriptSegmentModel);
    }
}
