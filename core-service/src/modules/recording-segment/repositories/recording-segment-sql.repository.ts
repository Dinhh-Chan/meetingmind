import { SqlRepository } from "@module/repository/sequelize/sql.repository";
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ModelCtor } from "sequelize-typescript";
import { RecordingSegment } from "../entities/recording-segment.entity";
import { RecordingSegmentModel } from "../models/recording-segment.model";
import { RecordingSegmentRepository } from "./recording-segment-repository.interface";

@Injectable()
export class RecordingSegmentSqlRepository
    extends SqlRepository<RecordingSegment>
    implements RecordingSegmentRepository
{
    constructor(
        @InjectModel(RecordingSegmentModel)
        private readonly recordingSegmentModel: ModelCtor<RecordingSegmentModel>,
    ) {
        super(recordingSegmentModel);
    }
}
