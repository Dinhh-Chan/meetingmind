import { UserModule } from "@module/user/user.module";
import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import {
    KNOWLEDGE_AI_TIMEOUT_MS,
    KnowledgeAiClient,
} from "./services/knowledge-ai.client";
import { KnowledgeIndexService } from "./services/knowledge-index.service";

/**
 * Phần Core của hỏi đáp tri thức: phát lệnh lập chỉ mục và gọi ai-service.
 *
 * Tách riêng, không phụ thuộc module nghiệp vụ nào, để cả meeting-processing
 * (transcript) lẫn workflow (biên bản, quyết định, tài liệu) dùng chung mà
 * không tạo vòng import. Route hỏi đáp nằm ở WorkflowModule.
 */
@Module({
    imports: [
        UserModule,
        HttpModule.register({
            timeout: KNOWLEDGE_AI_TIMEOUT_MS,
            maxRedirects: 0,
        }),
    ],
    providers: [KnowledgeIndexService, KnowledgeAiClient],
    exports: [KnowledgeIndexService, KnowledgeAiClient],
})
export class KnowledgeModule {}
