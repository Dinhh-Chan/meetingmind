import { PartialType } from "@nestjs/swagger";
import { ProcessingJob } from "../entities/processing-job.entity";

export class ProcessingJobConditionDto extends PartialType(ProcessingJob) {}
