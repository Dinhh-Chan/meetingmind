import { PartialType } from "@nestjs/swagger";
import { CreateProcessingJobDto } from "./create-processing-job.dto";

export class UpdateProcessingJobDto extends PartialType(CreateProcessingJobDto) {}
