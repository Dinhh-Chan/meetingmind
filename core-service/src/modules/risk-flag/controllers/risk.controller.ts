import { Authorization, ReqUser } from "@common/decorator/auth.decorator";
import { User } from "@module/user/entities/user.entity";
import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import { RiskDetectorService } from "../services/risk-detector.service";

export class AcknowledgeRiskDto {
    @IsString()
    @MinLength(1)
    reason: string;
}

/** Cảnh báo rủi ro do máy chủ phát hiện (quá hạn, phụ thuộc chưa xong, dồn deadline). */
@Controller("workflow/risks")
@ApiTags("workflow")
@Authorization()
export class RiskController {
    constructor(private readonly riskDetectorService: RiskDetectorService) {}

    @Get()
    list(@ReqUser() user: User, @Query("workspaceId") workspaceId: string) {
        return this.riskDetectorService.listForUser(user._id, workspaceId);
    }

    @Post(":id/acknowledge")
    acknowledge(@ReqUser() user: User, @Param("id") id: string, @Body() dto: AcknowledgeRiskDto) {
        return this.riskDetectorService.acknowledge(user._id, id, dto.reason);
    }
}
