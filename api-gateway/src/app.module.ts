import { DynamicModule, MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthMiddleware } from "./gateway/auth.middleware";
import { GATEWAY_CONFIG, GatewayConfig } from "./gateway/config";
import { HealthController } from "./gateway/health.controller";
import { ProxyMiddleware } from "./gateway/proxy.middleware";
import { RateLimitMiddleware } from "./gateway/rate-limit.middleware";
import { RequestLogMiddleware } from "./gateway/request-log.middleware";

@Module({})
export class AppModule implements NestModule {
    static register(config: GatewayConfig): DynamicModule {
        return {
            module: AppModule,
            imports: [JwtModule.register({})],
            controllers: [HealthController],
            providers: [
                { provide: GATEWAY_CONFIG, useValue: config },
                RequestLogMiddleware,
                RateLimitMiddleware,
                AuthMiddleware,
                ProxyMiddleware,
            ],
        };
    }

    /** Mọi request (trừ health của chính gateway): ghi log → giới hạn → kiểm tra token → chuyển tiếp. */
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(RequestLogMiddleware, RateLimitMiddleware, AuthMiddleware, ProxyMiddleware)
            .exclude({ path: "gateway/health", method: RequestMethod.GET })
            .forRoutes({ path: "{*splat}", method: RequestMethod.ALL });
    }
}
