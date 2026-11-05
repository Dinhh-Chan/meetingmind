import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { DOWNSTREAM_QUEUES, MEETINGMIND_EXCHANGE } from "../common/constant";

/** Phần amqplib cần dùng; core-service không cài @types/amqplib. */
interface AmqpChannel {
    assertExchange(
        name: string,
        type: string,
        options: object,
    ): Promise<unknown>;
    assertQueue(name: string, options: object): Promise<unknown>;
    bindQueue(queue: string, exchange: string, key: string): Promise<unknown>;
    close(): Promise<void>;
    on(event: "error", listener: (err: Error) => void): unknown;
}

interface AmqpRawConnection {
    createChannel(): Promise<AmqpChannel>;
}

/**
 * Dựng sẵn queue + binding của bên nhận (DOWNSTREAM_QUEUES) để lệnh Core phát
 * ra không rơi mất khi bên nhận chưa từng chạy. Khai báo lặp là vô hại.
 *
 * Không dùng `queues` trong cấu hình golevelup: chúng được khai trên kênh mặc
 * định, một queue lệch tham số sẽ làm server đóng kênh đó và Core mất luôn
 * kênh phát/nhận tới lần kết nối lại sau. Ở đây mỗi queue dùng một kênh riêng,
 * lỗi chỉ ghi log.
 */
@Injectable()
export class RabbitTopologyService implements OnApplicationBootstrap {
    private readonly logger = new Logger(RabbitTopologyService.name);

    constructor(private readonly amqp: AmqpConnection) {}

    onApplicationBootstrap() {
        const manager = this.amqp.managedConnection;
        // Chạy lại mỗi lần kết nối lại: RabbitMQ dựng lại mất dữ liệu thì queue cũng mất.
        manager.on("connect", ({ connection }) => {
            void this.assertAll(connection as unknown as AmqpRawConnection);
        });
        if (manager.isConnected()) {
            void this.assertAll(
                this.amqp.connection as unknown as AmqpRawConnection,
            );
        }
    }

    private async assertAll(connection: AmqpRawConnection) {
        for (const { queue, routingKeys } of DOWNSTREAM_QUEUES) {
            let channel: AmqpChannel | undefined;
            try {
                channel = await connection.createChannel();
                // Lỗi kênh đã bắt qua promise bên dưới; thiếu listener thì
                // EventEmitter ném lỗi ra ngoài và làm sập tiến trình.
                channel.on("error", () => undefined);
                await channel.assertExchange(MEETINGMIND_EXCHANGE, "topic", {
                    durable: true,
                });
                await channel.assertQueue(queue, { durable: true });
                for (const key of routingKeys) {
                    await channel.bindQueue(queue, MEETINGMIND_EXCHANGE, key);
                }
                this.logger.log(
                    `Đã dựng queue ${queue} ← ${routingKeys.join(", ")}`,
                );
            } catch (err) {
                this.logger.warn(
                    `Không dựng được queue ${queue}: ${err?.message ?? err}`,
                );
            } finally {
                await channel?.close().catch(() => undefined);
            }
        }
    }
}
