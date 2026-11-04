import { Config } from "@remotion/cli/config";

// Dùng Chrome hệ thống, không để Remotion tự tải trình duyệt.
Config.setBrowserExecutable("/usr/bin/google-chrome");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
// Gắn nhãn & chuyển màu chuẩn BT.709 (dải giới hạn) -> hiển thị đúng màu trên mọi trình phát.
Config.setColorSpace("bt709");
Config.setAudioBitrate("320k");
// GPU qua ANGLE/EGL giúp filter SVG & blur nhanh hơn; đổi thành "swangle" nếu máy không có GPU.
Config.setChromiumOpenGlRenderer("angle-egl");
Config.setConcurrency(6);
