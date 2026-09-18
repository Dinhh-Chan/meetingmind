import { ResponseDataDto } from "@common/dto/response-data.dto";
import {
    CallHandler,
    ExecutionContext,
    HttpStatus,
    Injectable,
    NestInterceptor,
} from "@nestjs/common";
import { Response } from "express";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<ResponseDataDto | unknown> {
        // Handler của RabbitMQ/TCP không có HTTP response để gắn status, và
        // kết quả của chúng không đi ra ngoài nên cũng không cần bọc.
        if (context.getType() !== "http") {
            return next.handle();
        }
        context.switchToHttp().getResponse<Response>().status(HttpStatus.OK);
        return next.handle().pipe(
            map((data) => {
                const result = new ResponseDataDto(data);
                return result;
            }),
        );
    }
}
