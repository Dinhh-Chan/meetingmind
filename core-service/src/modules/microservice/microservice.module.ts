import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { Global, Module } from "@nestjs/common";
import { ClientsModule } from "@nestjs/microservices";
import { RgpcClientModules } from "./grpc/common/grpc-client-factory";
import { RabbitMQConfigService } from "./rabbitmq/rabbitmq-config.service";
import { MicroserviceClientController } from "./microservice-client.controller";
import { MicroserviceController } from "./microservice.controller";
import { MicroserviceService } from "./microservice.service";
import {
    TcpClientProviders,
    TcpClients,
    getTcpClientToken,
} from "./tcp/tcp-client.provider";

@Global()
@Module({
    imports: [
        RabbitMQModule.forRootAsync({
            useClass: RabbitMQConfigService,
        }),
        ClientsModule.registerAsync([...RgpcClientModules]),
    ],
    providers: [MicroserviceService, ...TcpClientProviders],
    controllers: [MicroserviceController, MicroserviceClientController],
    exports: [RabbitMQModule, ClientsModule, ...TcpClients.map(getTcpClientToken)],
})
export class MicroserviceModule {}
