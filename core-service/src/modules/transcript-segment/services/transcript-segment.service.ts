import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { TranscriptSegment } from "../entities/transcript-segment.entity";
import { TranscriptSegmentRepository } from "../repositories/transcript-segment-repository.interface";

@Injectable()
export class TranscriptSegmentService extends BaseService<TranscriptSegment, TranscriptSegmentRepository> {
    constructor(
        @InjectRepository(Entity.TRANSCRIPT_SEGMENT)
        private readonly transcriptSegmentRepository: TranscriptSegmentRepository,
    ) {
        super(transcriptSegmentRepository);
    }
}
