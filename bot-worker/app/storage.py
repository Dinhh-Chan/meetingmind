"""Đẩy bản ghi lên MinIO. Bot tự upload (ARCHITECTURE: Core không làm trung gian
audio), rồi chỉ báo object key cho Core."""

import os
from pathlib import Path

from minio import Minio


def bucket() -> str:
    return os.environ.get("MINIO_BUCKET", "meetingmind")


def upload(path: Path, object_key: str, content_type: str = "audio/webm") -> None:
    client = Minio(
        f"{os.environ.get('MINIO_ENDPOINT', 'minio')}:{os.environ.get('MINIO_PORT', '9000')}",
        access_key=os.environ.get("MINIO_ACCESS_KEY", "minioadmin"),
        secret_key=os.environ.get("MINIO_SECRET_KEY", "minioadmin"),
        secure=os.environ.get("MINIO_USE_SSL", "0") in ("1", "true", "True"),
    )
    if not client.bucket_exists(bucket()):
        client.make_bucket(bucket())
    client.fput_object(bucket(), object_key, str(path), content_type=content_type)
