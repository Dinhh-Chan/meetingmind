import { Controller, Get, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import { GATEWAY_CONFIG, GatewayConfig } from "./config";

/** Gateway còn sống và có gọi được core-service không (Docker healthcheck, giám sát). */
@Controller("gateway")
export class HealthController {
    constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

    @Get("health")
    async health(@Res() res: Response) {
        const started = Date.now();
        const core = await fetch(`${this.config.coreUrl}/app/timestamp`, { signal: AbortSignal.timeout(3000) })
            .then((r) => r.ok)
            .catch(() => false);
        res.status(core ? 200 : 503).json({
            status: core ? "ok" : "degraded",
            upstreams: { core: { ok: core, ms: Date.now() - started } },
        });
    }
}
