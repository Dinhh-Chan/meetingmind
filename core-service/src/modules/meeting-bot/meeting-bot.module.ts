import { BotSessionModule } from "@module/bot-session/bot-session.module";
import { MediaFileModule } from "@module/media-file/media-file.module";
import { MeetingProcessingModule } from "@module/meeting-processing/meeting-processing.module";
import { MeetingModule } from "@module/meeting/meeting.module";
import { MessagingModule } from "@module/messaging/messaging.module";
import { Module } from "@nestjs/common";
import { MeetingBotConsumer } from "./consumers/meeting-bot.consumer";
import { MeetingBotService } from "./services/meeting-bot.service";

@Module({
    imports: [
        MeetingModule,
        BotSessionModule,
        MessagingModule,
        MediaFileModule,
        MeetingProcessingModule,
    ],
    providers: [MeetingBotService, MeetingBotConsumer],
    exports: [MeetingBotService],
})
export class MeetingBotModule {}
