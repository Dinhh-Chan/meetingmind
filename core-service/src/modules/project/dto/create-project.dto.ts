import { OmitType } from "@nestjs/swagger";
import { Project } from "../entities/project.entity";

export class CreateProjectDto extends OmitType(Project, ["_id"] as const) {}
