import { BaseService } from "@config/service/base.service";
import { Entity } from "@module/repository";
import { InjectRepository } from "@module/repository/common/repository";
import { Injectable } from "@nestjs/common";
import { MinutesTemplate } from "../entities/minutes-template.entity";
import { MinutesTemplateRepository } from "../repositories/minutes-template-repository.interface";

/** Mẫu có sẵn khi workspace chưa tạo mẫu nào (theo thiết kế màn Mẫu biên bản). */
export const DEFAULT_TEMPLATES: { name: string; sections: string[] }[] = [
    {
        name: "Họp tiến độ",
        sections: ["Mục tiêu", "Người tham dự", "Nội dung theo agenda", "Quyết định", "Task", "Vấn đề còn mở", "Bước tiếp theo"],
    },
    {
        name: "Lập kế hoạch",
        sections: ["Mục tiêu sprint", "Phạm vi", "Ước lượng & phân công", "Rủi ro", "Quyết định", "Task"],
    },
    {
        name: "Họp khách hàng",
        sections: ["Thông tin khách", "Yêu cầu", "Cam kết", "Quyết định", "Task", "Câu hỏi chờ phản hồi"],
    },
    {
        name: "Tổng kết",
        sections: ["Kết quả đạt được", "Điều làm tốt", "Điều cần cải thiện", "Bài học", "Task cải tiến"],
    },
];

@Injectable()
export class MinutesTemplateService extends BaseService<MinutesTemplate, MinutesTemplateRepository> {
    constructor(
        @InjectRepository(Entity.MINUTES_TEMPLATE)
        private readonly minutesTemplateRepository: MinutesTemplateRepository,
    ) {
        super(minutesTemplateRepository);
    }

    /** Mẫu của workspace; lần đầu tạo sẵn bộ mẫu mặc định. */
    async listFor(workspaceId: string) {
        let list = await this.minutesTemplateRepository.getMany({ workspaceId });
        if (!list.length) {
            for (const t of DEFAULT_TEMPLATES) {
                await this.minutesTemplateRepository.create({ workspaceId, name: t.name, sections: t.sections });
            }
            list = await this.minutesTemplateRepository.getMany({ workspaceId });
        }
        const createdAt = (t: object) => new Date((t as { createdAt?: Date }).createdAt ?? 0).getTime();
        return list.sort((a, b) => createdAt(a) - createdAt(b));
    }
}
