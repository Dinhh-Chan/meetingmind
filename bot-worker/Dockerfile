# Image chính thức của Playwright: có Chromium và thư viện hệ thống đi kèm.
FROM mcr.microsoft.com/playwright/python:v1.64.1-noble

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Meet hay từ chối trình duyệt headless: chạy Chromium có giao diện trên màn
# hình ảo Xvfb.
# x11vnc + noVNC chỉ dùng cho login.sh: người dùng đăng nhập tài khoản Google của
# bot một lần qua trình duyệt.
# PulseAudio với loa ảo: Chrome cần thiết bị phát, không có thì âm thanh WebRTC
# của người khác không chảy và bot chỉ ghi được im lặng.
RUN apt-get update && apt-get install -y --no-install-recommends xvfb x11vnc novnc websockify pulseaudio \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["python", "-m", "app.main"]
