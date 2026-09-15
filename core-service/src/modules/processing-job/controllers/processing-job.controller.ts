import { BaseControllerFactory } from "@config/controller/base-controller-factory";
import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateProcessingJobDto } from "../dto/create-processing-job.dto";
import { ProcessingJobConditionDto } from "../dto/processing-job-condition.dto";
import { UpdateProcessingJobDto } from "../dto/update-processing-job.dto";
import { ProcessingJob } from "../entities/processing-job.entity";
import { ProcessingJobService } from "../services/processing-job.service";

@Controller("processing-job")
@ApiTags("processing-job")
export class ProcessingJobController extends BaseControllerFactory<ProcessingJob>(
    ProcessingJob,
    ProcessingJobConditionDto,
    CreateProcessingJobDto,
    UpdateProcessingJobDto,
    {
        import: { enable: false },
    },
) {
    constructor(private readonly processingJobService: ProcessingJobService) {
        super(processingJobService);
    }
}
