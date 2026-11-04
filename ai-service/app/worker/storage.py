"""Đọc bản ghi từ MinIO. Core chỉ gửi bucket/objectKey, không gửi nội dung file."""

import os
import tempfile
from pathlib import Path

from minio import Minio


def _client() -> Minio:
    endpoint = os.environ.get("MINIO_ENDPOINT", "minio")
    port = os.environ.get("MINIO_PORT", "9000")
    return Minio(
        f"{endpoint}:{port}",
        access_key=os.environ.get("MINIO_ACCESS_KEY", "minioadmin"),
        secret_key=os.environ.get("MINIO_SECRET_KEY", "minioadmin"),
        secure=os.environ.get("MINIO_USE_SSL", "0") in ("1", "true", "True"),
    )


def download_to_temp(bucket: str, object_key: str) -> Path:
    """Tải về file tạm, giữ phần mở rộng để bộ giải mã nhận đúng định dạng.

    Người gọi phải xoá file sau khi dùng.
    """
    suffix = Path(object_key).suffix
    fd, name = tempfile.mkstemp(prefix="mm-audio-", suffix=suffix)
    os.close(fd)
    _client().fget_object(bucket, object_key, name)
    return Path(name)
