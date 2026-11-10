import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import type { GatewayConfig } from "./gateway/config";

/** Dựng app gateway (dùng chung cho main và test). */
export async function createGateway(config: GatewayConfig) {
    if (!config.jwtSecret) {
        throw new Error("Thiếu JWT_SECRET: gateway cần cùng khoá với core-service để kiểm tra token");
    }
    // Không parse body: request được chuyển nguyên luồng sang dịch vụ phía sau.
    const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), {
        bodyParser: false,
        logger: ["log", "warn", "error"],
    });
    app.set("trust proxy", config.trustProxy);
    app.disable("x-powered-by");
    app.enableShutdownHooks();
    return app;
}
