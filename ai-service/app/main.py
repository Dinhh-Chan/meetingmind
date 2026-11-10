import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi.exceptions import ValidationException
import uvicorn
from fastapi import FastAPI
from fastapi_sqlalchemy import DBSessionMiddleware
from starlette.middleware.cors import CORSMiddleware

from app.api import api_knowledge, api_voice
from app.core.router import router
from app.models import Base
from app.core.database import engine
from app.core.config import settings
from app.worker import knowledge_store, knowledge_threads
from app.utils.exception_handler import (
    CustomException,
    fastapi_error_handler,
    validation_exception_handler,
    custom_error_handler,
)

logging.config.fileConfig(settings.LOGGING_CONFIG_FILE, disable_existing_loggers=False)
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await asyncio.to_thread(knowledge_store.ensure_schema)
        # Lịch sử hội thoại chỉ ai-service dùng nên tạo ở đây, ai-worker không cần.
        await asyncio.to_thread(knowledge_threads.ensure_schema)
    except Exception as err:  # noqa: BLE001 - lần hỏi đầu tiên sẽ thử tạo lại
        logging.getLogger("app.knowledge").warning("Chưa tạo được bảng hỏi đáp: %s", err)
    yield


def get_application() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/re-docs",
        openapi_url=f"{settings.API_PREFIX}/openapi.json",
        description="""
        Base frame with FastAPI micro framework + Postgresql
            - Login/Register with JWT
            - Permission
            - CRUD User
            - Unit testing with Pytest
            - Dockerize
        """,
        debug=settings.DEBUG,
        swagger_ui_init_oauth={
            "clientId": settings.KEYCLOAK_CLIENT_ID,
            "scopes": {"openid": "OpenID Connect scope"},
        },
        swagger_ui_parameters={
            "docExpansion": "none",
        },
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.add_middleware(DBSessionMiddleware, db_url=settings.DATABASE_URL)
    application.include_router(router, prefix=settings.API_PREFIX)
    # Hỏi đáp nội bộ: ngoài tiền tố /api, xác thực bằng X-Internal-Token thay vì JWT người dùng.
    application.include_router(api_knowledge.router)
    # Đăng ký giọng nói: Core gửi mẫu đọc, nhận vân giọng (cũng xác thực bằng X-Internal-Token).
    application.include_router(api_voice.router)
    application.add_exception_handler(CustomException, custom_error_handler)
    application.add_exception_handler(ValidationException, validation_exception_handler)
    application.add_exception_handler(Exception, fastapi_error_handler)

    return application


app = get_application()
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=settings.DEBUG)
