FROM python:3.12.3

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1


RUN apt update 
RUN apt upgrade -y 
RUN apt install -y nano unixodbc unixodbc-dev
# OCR tài liệu scan và ảnh để hỏi đáp (app/worker/document_text.py): Tesseract
# kèm dữ liệu tiếng Việt/Anh, pdftoppm (poppler-utils) rasterize từng trang PDF.
# Chạy cục bộ: tài liệu nội bộ không gửi ra dịch vụ OCR bên ngoài.
RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr tesseract-ocr-vie tesseract-ocr-eng poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN pip install -r requirements.txt

# Máy có GPU NVIDIA: build với WITH_CUDA=1 để có cuBLAS/cuDNN cho CTranslate2
# (faster-whisper) chạy trên GPU, rồi đặt AI_WHISPER_DEVICE=cuda. Mặc định chỉ
# CPU, image nhỏ hơn. LD_LIBRARY_PATH trỏ tới thư viện pip cài (không có thì bỏ qua).
ARG WITH_CUDA=0
RUN if [ "$WITH_CUDA" = "1" ]; then pip install --no-cache-dir "nvidia-cublas-cu12==12.*" "nvidia-cudnn-cu12==9.*"; fi
ENV LD_LIBRARY_PATH=/usr/local/lib/python3.12/site-packages/nvidia/cublas/lib:/usr/local/lib/python3.12/site-packages/nvidia/cudnn/lib

COPY . .

RUN chmod 777 entrypoint.sh

