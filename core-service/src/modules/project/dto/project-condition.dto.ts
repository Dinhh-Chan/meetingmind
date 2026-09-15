import { PartialType } from "@nestjs/swagger";
import { Project } from "../entities/project.entity";

export class ProjectConditionDto extends PartialType(Project) {}
