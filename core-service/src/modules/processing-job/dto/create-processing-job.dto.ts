import { OmitType } from "@nestjs/swagger";
import { ProcessingJob } from "../entities/processing-job.entity";

export class CreateProcessingJobDto extends OmitType(ProcessingJob, ["_id"] as const) {}
