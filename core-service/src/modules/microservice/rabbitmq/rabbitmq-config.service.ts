import { Configuration } from "@config/configuration";
import { ModuleConfigFactory } from "@golevelup/nestjs-modules";
import { RabbitMQConfig } from "@golevelup/nestjs-rabbitmq";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MEETINGMIND_EXCHANGE } from "@module/messaging/common/constant";
import { RabbitMQExchange } from "./constant";

@Injectable()
export class RabbitMQConfigService
    implements ModuleConfigFactory<RabbitMQConfig>
{
    constructor(private readonly configService: ConfigService<Configuration>) {}
    /** golevelup v6 gọi phương thức này (ConfigurableModuleBuilder). */
    create(): RabbitMQConfig {
        return this.createModuleConfig();
    }

    createModuleConfig(): RabbitMQConfig {
        const { rabbitMQ } = this.configService.get("microservice", {
            infer: true,
        });
        return {
            uri: rabbitMQ.url,
            channels: {
                default: {
                    default: true,
                },
            },
            exchanges: [
                { type: "fanout", name: RabbitMQExchange.DEFAULT_FANOUT },
                // Exchange nghiệp vụ: routing key chính là tên sự kiện
                { type: "topic", name: MEETINGMIND_EXCHANGE },
            ],
            // Không chặn khởi động nếu RabbitMQ chưa sẵn sàng; outbox giữ lại
            // event và đẩy khi kết nối lên.
            connectionInitOptions: { wait: !Boolean(rabbitMQ.url) },
        };
    }
}
