# MeetingMind — Chrome extension

Đọc phụ đề trực tiếp của Google Meet rồi gửi về `core-service`.

**Không có bot vào phòng, không ghi âm, không lưu audio.** Cách này giống Tactiq
và khác đường bot (Otter, Fireflies) mô tả trong [ARCHITECTURE.md](../ARCHITECTURE.md).

## Vì sao có cả hai đường

Phụ đề do chính Google Meet sinh ra nên **kèm sẵn tên người nói** — không phải
đoán như khi tách giọng từ audio. Đổi lại, không có audio để nghe lại và phải
có người dự họp đã cài extension.

Cả hai đường gặp nhau ở `transcript_versions`, nên phần sau (biên bản, đề xuất
công việc, duyệt, task) dùng chung y hệt:

```
upload file    → MinIO → STT ─┐
bot            → MinIO → STT ─┼→ transcript_versions → biên bản → duyệt → task
extension      → phụ đề ──────┘   (bỏ qua STT)
```

## Cài đặt

1. `chrome://extensions` → bật **Developer mode**
2. **Load unpacked** → chọn thư mục `extension/`
3. Bấm biểu tượng extension, đăng nhập (mặc định `admin` / `admin`)
4. Dán **Workspace ID** — lấy từ `GET /workspace/page` hoặc Swagger `:3010/api`

## Dùng

1. Vào phòng Meet, **bật phụ đề** bằng nút CC (bắt buộc — không bật thì không có gì để đọc)
2. Bấm extension → **Bắt đầu ghi phụ đề**
3. Họp bình thường; extension gửi theo lô 5 giây một lần
4. Xong thì bấm **Kết thúc** → Core chốt phiên bản transcript và xin AI phân tích

Nút **Kiểm tra phụ đề** cho biết extension có đọc được không, kèm vài dòng mẫu.

## Khi Meet đổi giao diện

Class trong DOM của Meet bị làm rối và Google đổi định kỳ. Khi extension báo
"Chưa thấy phụ đề" dù đã bật CC:

1. Mở DevTools ở tab Meet → Console
2. Chạy `__mmDebug()`
3. Nếu in ra "KHÔNG THẤY": trong tab Elements tìm phần tử bao quanh vùng phụ đề,
   lấy một selector ổn định (ưu tiên `aria-label`, `role`, tránh class rối)
4. Thêm vào `CAPTION_CONTAINER_SELECTORS` ở đầu [content.js](content.js)
5. Tải lại extension và tab Meet

`extractBlocks()` cố ý **không dựa vào tên class** mà dựa vào cấu trúc — khối con
có ít nhất hai vùng text thì vùng đầu là tên người nói. Nhờ vậy nó sống sót qua
phần lớn các lần Google đổi class.

## Điểm cần biết

- **Tên người nói chỉ là "đề xuất".** Tên hiển thị trên Meet do người dùng tự
  đặt nên không phải bằng chứng danh tính. Core lưu `identityStatus = suggested`
  và tạo `speaker_aliases` với `userId` để trống; chủ trì xác nhận thì mới thành
  `confirmed`. Xem tài liệu nghiệp vụ mục 6.5.
- **Token hết hạn giữa cuộc họp** là chuyện thường (`JWT_EXP` mặc định 1 giờ).
  `background.js` tự gọi `/auth/refresh` khi gặp 401 rồi gửi lại.
- **Gửi lỗi thì không mất phụ đề**: lô bị trả lại buffer và gửi kèm lô sau.
- Mốc thời gian tính từ lúc bấm "Bắt đầu", không phải từ lúc cuộc họp mở.

## Chưa làm

- Chỉ hỗ trợ Google Meet. Teams và Zoom cần viết thêm hàm dò container riêng.
- Chưa có màn hình chọn workspace; phải dán ID bằng tay.
- Chưa ghi nhận `recording_consents` — dù không ghi âm thì vẫn nên báo cho
  người trong phòng biết đang có công cụ ghi lại nội dung.
