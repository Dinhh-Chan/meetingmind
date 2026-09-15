import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { RecordingSegment } from "../entities/recording-segment.entity";
import { RecordingSegmentRepository } from "../repositories/recording-segment-repository.interface";

@Injectable()
export class RecordingSegmentService extends BaseService<RecordingSegment, RecordingSegmentRepository> {
    constructor(
        @InjectRepository(Entity.RECORDING_SEGMENT)
        private readonly recordingSegmentRepository: RecordingSegmentRepository,
    ) {
        super(recordingSegmentRepository);
    }
}
