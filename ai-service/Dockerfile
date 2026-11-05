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

COPY . .

RUN chmod 777 entrypoint.sh

