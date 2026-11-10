import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { createGateway } from "./create-gateway";
import { loadConfig } from "./gateway/config";

async function bootstrap() {
    const config = loadConfig();
    const app = await createGateway(config);
    await app.listen(config.port, "0.0.0.0");
    Logger.log(`API gateway nghe cổng ${config.port}, chuyển tiếp tới ${config.coreUrl}`, "Bootstrap");
}

void bootstrap();
