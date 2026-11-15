#!/bin/sh

pip install -r requirements-local.txt
if [ "$DEBUG" = "true" ] && [ "${UVICORN_RELOAD:-true}" = "true" ]; then
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
elif [ "$DEBUG" = "true" ]; then
    # Máy chủ thật dùng GPU: một tiến trình (mỗi tiến trình nạp Whisper + PhoWhisper
    # ~6 GB GPU), không tự nạp lại code. Tiến trình chết thì container dừng và
    # Docker khởi động lại (restart: unless-stopped) thay vì treo "Up" mà không phục vụ.
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000
else
    exec gunicorn app.main:app --workers 17 --worker-class uvicorn.workers.UvicornWorker --threads 8 --timeout 120 --keep-alive 5 --bind 0.0.0.0:8000
fi
