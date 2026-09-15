import { Entity } from "@module/repository";
import { RepositoryProvider } from "@module/repository/common/repository";
import { Module } from "@nestjs/common";
import { TopicSqlRepository } from "./repository/topic-sql.repository";
import { UserTopicSqlRepository } from "./repository/user-topic-sql.repository";
import { TopicService } from "./topic.service";

@Module({
    providers: [
        TopicService,
        RepositoryProvider(Entity.TOPIC, TopicSqlRepository),
        RepositoryProvider(Entity.USER_TOPIC, UserTopicSqlRepository),
    ],
})
export class TopicModule {}
