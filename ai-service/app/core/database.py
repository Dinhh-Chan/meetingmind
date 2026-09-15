import os
from typing import Generator
from app.core.config import settings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Mỗi service chỉ được ghi vào schema của mình (xem ARCHITECTURE.md 3.2-3.3).
# Role mm_ai đã có search_path mặc định, khai thêm ở đây để rõ ý và để
# không phụ thuộc cấu hình phía database.
_SCHEMA = os.environ.get("POSTGRES_SCHEMA", "ai")

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"options": f"-csearch_path={_SCHEMA},public"},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator:
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()
