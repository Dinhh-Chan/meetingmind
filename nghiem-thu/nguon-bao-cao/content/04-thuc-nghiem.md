# Thực nghiệm và đánh giá

Chương này trình bày các thực nghiệm định lượng nhằm trả lời câu hỏi: hệ thống MeetingMind nhận dạng, tách người nói và trích xuất công việc chính xác đến đâu, chịu ảnh hưởng của nhiễu như thế nào, trả lời câu hỏi trên tri thức cuộc họp ra sao, xử lý một cuộc họp mất bao lâu và tốn bao nhiêu chi phí. Mọi con số trong chương được sinh ra từ các tập lệnh đánh giá chạy trên chính mã nguồn của hệ thống; kết quả thô (transcript, đầu ra JSON của LLM, thời gian từng bước) được lưu lại để có thể kiểm tra và chạy lại.

## Mục tiêu và câu hỏi thực nghiệm

Theo đề cương, nội dung kiểm thử gồm đánh giá độ chính xác của AI và đo lường thời gian tiết kiệm được. Nhóm cụ thể hoá thành bảy câu hỏi thực nghiệm:

1. Mô-đun phiên âm (Whisper) đạt tỷ lệ lỗi từ bao nhiêu trên hội thoại cuộc họp tiếng Việt có thuật ngữ kỹ thuật, và suy giảm thế nào khi có nhiễu?
2. Từ điển thuật ngữ và mô hình lớn hơn cải thiện được bao nhiêu?
3. Mô-đun tách người nói phân biệt người nói đúng đến đâu, có phát hiện được đoạn nói chồng không, và có sinh "câu bịa" ở đoạn chỉ có nhiễu không?
4. Trong các LLM khả dụng, mô hình nào trích xuất biên bản đúng nhất trên các tình huống dễ gây sai (đề xuất khác quyết định, đính chính, đổi người làm, chuyện ngoài lề)?
5. Khi ghép cả chuỗi từ âm thanh đến công việc, lỗi nhận dạng ảnh hưởng thế nào đến chất lượng trích xuất?
6. Xử lý một cuộc họp mất bao lâu trên phần cứng phổ thông, chi phí bao nhiêu, và ước tính tiết kiệm được bao nhiêu thời gian của con người?
7. Chức năng hỏi đáp tri thức có trả lời đúng và kèm trích nguồn, có biết trả lời "chưa đủ thông tin" khi câu hỏi nằm ngoài nội dung cuộc họp, có tôn trọng phân quyền không, và mỗi câu hỏi mất bao lâu?

## Môi trường và bộ dữ liệu thực nghiệm

### Môi trường

Toàn bộ thực nghiệm chạy trên một máy tính xách tay cá nhân, không dùng GPU, để phản ánh điều kiện triển khai thực tế của một nhóm nhỏ. Mô-đun AI chạy trong đúng container ai-worker của hệ thống, nên kết quả phản ánh chính mã nguồn được triển khai. Cấu hình được tóm tắt trong [[tb-env]].

::table tb-env | Môi trường thực nghiệm
| Hạng mục | Cấu hình |
|---|---|
| CPU | Intel Core i7-10750H (6 nhân, 12 luồng, 2,6 GHz) |
| Bộ nhớ | 23 GB RAM, không có GPU |
| Hệ điều hành, đóng gói | Linux, Docker Compose (container ai-worker của hệ thống) |
| Nhận dạng tiếng nói | faster-whisper 1.2.1, mô hình small và medium, int8 trên CPU, beam size 5 |
| Tách người nói | sherpa-onnx 2.0.1, ERes2Net (3D-Speaker), ngưỡng tương đồng 0,3 |
| LLM | FPT AI Factory Serverless Inference, nhiệt độ 0,2 |
| Hỏi đáp tri thức | Vietnamese_Embedding, bge-reranker-v2-m3, GLM-5.2 (FPT AI Factory); pgvector 0.8.6 |
| Giọng tổng hợp dựng dữ liệu | FPT.AI-VITs (các giọng banmai, leminh, giahuy, ngoclam, kimngan, huyphong, minhquan) |

### Kịch bản cuộc họp có đáp án

Do không có sẵn bộ dữ liệu cuộc họp tiếng Việt công khai kèm nhãn công việc, nhóm tự xây dựng một kịch bản họp lập kế hoạch sprint của một nhóm phát triển ứng dụng đặt lịch phòng khám, gồm 30 lượt lời của 4 người (Lan – trưởng nhóm, Nam, Hùng và một thành viên chỉ xuất hiện dưới nhãn "Người nói 4" nhưng được gọi tên là Phương ở cuối buổi). Kịch bản được thiết kế có chủ đích để chứa các tình huống mà một trợ lý biên bản dễ làm sai:

- **Đề xuất chưa được chấp nhận:** "Hay là mình dùng luôn Firebase cho OTP?" không phải quyết định, mà dẫn tới một việc so sánh giá và một vấn đề còn mở.
- **Đính chính thời hạn:** hạn tích hợp thanh toán được nói là ngày 15 tháng 11 rồi sửa ngay thành ngày 18.
- **Đổi người thực hiện:** việc nhắc lịch "ban đầu định giao Nam" nhưng cuối cùng giao cho Hùng.
- **Việc thiếu thời hạn:** nhiều việc không nêu hạn, hệ thống không được tự điền.
- **Chuyện ngoài lề:** hai lượt lời bàn về bóng đá không được biến thành công việc.
- **Người nói chưa có tên:** việc viết tài liệu API của "Người nói 4" phải được gán cho Phương nhờ câu tổng kết.
- **Thuật ngữ tiếng Anh:** sprint, API, OTP, Firebase, eSMS, PostgreSQL, MongoDB, VNPay, MoMo, callback, Zalo, SMS, Swagger.

Đáp án gồm 8 công việc (kèm người thực hiện và thời hạn đúng), 2 quyết định (chốt PostgreSQL, chưa làm MoMo trong sprint này) và 3 vấn đề còn mở (chọn Firebase hay eSMS, gửi nhắc lịch qua Zalo hay SMS, ngân sách máy chủ).

### Dựng âm thanh bằng giọng tổng hợp

Từ kịch bản, mỗi lượt lời được tổng hợp thành tiếng nói bằng dịch vụ FPT.AI-VITs, mỗi người dùng một giọng khác nhau (hai giọng nam, hai giọng nữ). Các câu được ghép với khoảng nghỉ ngẫu nhiên 0,3–0,9 giây thành một bản ghi dài 151 giây, với mốc thời gian và người nói chuẩn của từng câu được lưu lại. Từ bản sạch, nhóm tạo thêm các điều kiện khó hơn như trong [[tb-conditions]]. Bản ghi tham chiếu có 443 tiếng (âm tiết) và 24 lần xuất hiện thuật ngữ tiếng Anh.

::table tb-conditions | Các điều kiện âm thanh thử nghiệm
| Điều kiện | Cách tạo | Mục đích |
|---|---|---|
| Sạch | Ghép các câu tổng hợp, không thêm nhiễu | Mức chuẩn |
| Nhiễu trắng 20 / 10 / 5 dB | Cộng nhiễu Gauss theo tỷ số tín hiệu trên nhiễu (SNR) | Micro kém, quạt, điều hoà |
| Đông người 10 dB | Cộng tiếng nói chuyện nền của 3 giọng khác (6 câu không liên quan, lặp lại chồng nhau) | Phòng họp mở, nhiều người nói xung quanh |
| Nói chồng + đoạn nhiễu | 4 chỗ người sau chen vào 1,2 giây cuối câu người trước; chèn 8 giây chỉ có nhiễu nền; nhiễu nhẹ 25 dB | Kiểm tra phát hiện nói chồng và hiện tượng ảo giác |

Cách dựng dữ liệu bằng giọng tổng hợp cho phép kiểm soát hoàn toàn đáp án và điều kiện nhiễu, nhưng có hạn chế là giọng tổng hợp đều và rõ hơn giọng nói tự nhiên, đồng thời đọc thuật ngữ tiếng Anh theo cách phát âm tiếng Việt. Hạn chế này được bàn ở cuối chương.

## Độ đo đánh giá

**Tỷ lệ lỗi từ (WER) và tỷ lệ lỗi ký tự (CER).** WER được tính bằng khoảng cách chỉnh sửa giữa chuỗi tiếng của bản nhận dạng và bản chuẩn [@levenshtein1966], sau khi đưa về chữ thường và bỏ dấu câu. Do Whisper viết số bằng chữ số ("thứ 4", "12") còn bản chuẩn viết bằng chữ ("thứ Tư", "mười hai"), nhóm báo cáo thêm WER sau khi chuẩn hoá cách viết số (đọc số 0–99 thành chữ, thứ trong tuần thành chữ). Đây là bước chuẩn hoá văn bản thông thường khi đánh giá nhận dạng tiếng nói, vì hai cách viết mang cùng nội dung. Trong chương này, "WER" được hiểu là WER đã chuẩn hoá số, trừ khi ghi khác.

**Độ đúng thuật ngữ.** Số lần thuật ngữ trong danh sách ở trên được nhận dạng đúng nguyên dạng, trên tổng 24 lần xuất hiện.

**Độ đúng người nói.** Với mỗi đoạn transcript đầu ra, tính thời lượng trùng với từng câu chuẩn; tìm cách ghép một-một tốt nhất giữa nhãn máy ("Người nói 1, 2…") và người thật; độ đúng là tỷ lệ thời lượng được gán đúng người trên tổng thời lượng trùng. Độ đo này tương ứng với phần "nhầm người" của DER, không tính phần bỏ sót hay báo thừa lời nói (vốn do Whisper quyết định).

**Phát hiện nói chồng.** Số vùng nói chồng chuẩn có ít nhất một đoạn được gắn cờ trùng lên (độ nhạy), và số đoạn bị gắn cờ trên các bản ghi không có nói chồng (báo nhầm).

**Điểm trích xuất biên bản.** Bộ chấm tự động gồm 15 tiêu chí: 8 công việc với người thực hiện và thời hạn đúng (kể cả việc đã đổi người, hạn đã đính chính), 1 tiêu chí gán đúng tên Phương cho "Người nói 4", 2 quyết định, 3 vấn đề còn mở và tóm tắt viết bằng tiếng Việt. Ngoài ra có 7 "bẫy", mỗi bẫy dính bị trừ 1 điểm: giữ hạn 15/11 chưa đính chính, giao nhắc lịch cho Nam, biến MoMo hoặc chuyện bóng đá thành công việc, coi đề xuất Firebase hoặc nâng gói máy chủ là quyết định, tự bịa thời hạn. Bộ chấm khớp theo từ khoá nên khá nghiêm: một công việc đúng nhưng ghi "thứ 4" thay vì "thứ Tư" vẫn bị coi là thiếu; với đầu ra từ transcript do máy nhận dạng, nhóm báo cáo cả điểm nghiêm ngặt và điểm sau khi chuẩn hoá cách viết thứ trong tuần.

**Thời gian và chi phí.** Thời gian thực thi từng bước và hệ số thời gian thực (RTF, thời gian xử lý chia thời lượng âm thanh); chi phí LLM tính theo số token và bảng giá của nhà cung cấp.

## Kết quả nhận dạng tiếng nói

[[tb-stt]] và [[fig-wer]] trình bày kết quả nhận dạng của Whisper small (cấu hình mặc định của hệ thống), Whisper small có từ điển thuật ngữ, và Whisper medium.

::table tb-stt | Kết quả nhận dạng tiếng nói theo điều kiện âm thanh
| Điều kiện | Cấu hình | WER thô (%) | WER chuẩn hoá số (%) | CER (%) | Thuật ngữ đúng |
|---|---|---|---|---|---|
| Sạch | small | 26,6 | 21,7 | 15,8 | 2/24 |
| Sạch | small + từ điển | 26,9 | 22,4 | 18,8 | 11/24 |
| Sạch | medium | 18,7 | 14,7 | 10,9 | 7/24 |
| Nhiễu trắng 20 dB | small | 30,0 | 25,5 | 16,8 | 3/24 |
| Nhiễu trắng 10 dB | small | 31,1 | 26,9 | 19,7 | 7/24 |
| Nhiễu trắng 10 dB | small + từ điển | 27,1 | 22,8 | 17,9 | 16/24 |
| Nhiễu trắng 10 dB | medium | 26,0 | 22,4 | 14,2 | 10/24 |
| Nhiễu trắng 5 dB | small | 40,9 | 36,6 | 25,5 | 6/24 |
| Đông người 10 dB | small | 31,6 | 26,9 | 18,5 | 3/24 |
| Đông người 10 dB | small + từ điển | 26,6 | 22,1 | 16,2 | 12/24 |
| Đông người 10 dB | medium | 22,6 | 18,3 | 14,3 | 7/24 |
| Nói chồng + đoạn nhiễu | small | 30,9 | 25,7 | 19,4 | 2/24 |

::figure fig-wer | Tỷ lệ lỗi từ (đã chuẩn hoá số) theo điều kiện âm thanh và cấu hình | 15.5

Với cấu hình mặc định (small, int8, CPU), WER ở điều kiện sạch là 21,7% và CER là 15,8%. Mức lỗi tăng dần theo nhiễu: khoảng 25–27% ở SNR 20–10 dB và ở nhiễu đông người, lên 36,6% khi nhiễu rất mạnh (SNR 5 dB). Nghĩa là mô hình chịu được nhiễu vừa phải mà không sụp đổ, nhưng chất lượng giảm rõ khi tín hiệu kém.

Phân tích lỗi cho thấy nguồn lỗi lớn nhất là **thuật ngữ tiếng Anh**: ở điều kiện sạch, Whisper small chỉ nhận đúng 2/24 lần xuất hiện thuật ngữ. "PostgreSQL" bị nhận thành "POSTEGARER-ESQUILLER", "Swagger" thành "so gơ", "eSMS" thành "EAS-MS", "MoMo" thành "mô mô". Một phần nguyên nhân nằm ở dữ liệu: giọng tổng hợp đọc thuật ngữ theo cách phát âm tiếng Việt, khác cách nói của người thật. Nguồn lỗi thứ hai là **dấu thanh và các từ gần âm** ("chốt" thành "chất", "đăng nhập" thành "đang nhập", "cuối tuần này" thành "cuối tôm nay"), điển hình của mô hình đa ngôn ngữ cỡ nhỏ với tiếng Việt.

**Từ điển thuật ngữ** (đưa danh sách thuật ngữ của dự án vào bước giải mã qua tham số hotwords của faster-whisper) cải thiện mạnh độ đúng thuật ngữ: từ 2 lên 11/24 ở điều kiện sạch, từ 7 lên 16/24 ở nhiễu trắng 10 dB và từ 3 lên 12/24 ở nhiễu đông người. Ở hai điều kiện nhiễu, WER giảm khoảng 4–5 điểm phần trăm. Tuy nhiên ở điều kiện sạch, WER tổng thể không giảm (22,4% so với 21,7%) và CER tăng nhẹ, do từ điển đôi khi kéo cả những đoạn không chứa thuật ngữ về phía các từ trong danh sách. Kết luận rút ra là từ điển thuật ngữ đáng dùng khi mục tiêu là giữ đúng tên công nghệ, sản phẩm trong biên bản, và nên được cấu hình theo từng dự án thay vì một danh sách chung.

**Mô hình medium** giảm WER ở điều kiện sạch từ 21,7% xuống 14,7% (giảm khoảng một phần ba) và CER từ 15,8% xuống 10,9%; ở nhiễu trắng 10 dB, WER giảm từ 26,9% xuống 22,4% và ở nhiễu đông người từ 26,9% xuống 18,3%, nhưng chạy chậm hơn khoảng 2,7 lần trên CPU (xem mục thời gian xử lý). Đây là đánh đổi điển hình giữa độ chính xác và tài nguyên tính toán; với máy chủ có GPU, mô hình medium hoặc lớn hơn là lựa chọn hợp lý hơn.

## Kết quả tách người nói và phát hiện nói chồng

::table tb-diar | Kết quả tách người nói (Whisper small)
| Điều kiện | Số người tìm được / thực tế | Độ đúng người nói (%) | Đoạn bị gắn cờ nói chồng |
|---|---|---|---|
| Sạch | 4/4 | 99,5 | 8 / 35 đoạn (không có nói chồng thật) |
| Nhiễu trắng 20 dB | 4/4 | 98,9 | 8 / 37 |
| Nhiễu trắng 10 dB | 5/4 | 94,8 | 11 / 44 |
| Nhiễu trắng 5 dB | 7/4 | 88,0 | 10 / 40 |
| Đông người 10 dB | 7/4 | 84,9 | 8 / 48 |
| Nói chồng + đoạn nhiễu | 5/4 | 93,4 | 1 / 42 (không trùng vùng nói chồng nào trong 4 vùng) |

Kết quả ở [[tb-diar]] cho thấy mô-đun tách người nói hoạt động tốt ở điều kiện sạch và nhiễu nhẹ: tìm đúng 4 người và gán đúng người cho 99,5% thời lượng lời nói. Khi nhiễu tăng, mô-đun có xu hướng **tách thừa** (5–7 cụm cho 4 người): một số cửa sổ nhiễu nặng tạo vector đặc trưng lệch khỏi cụm của người nói và hình thành cụm nhỏ riêng. Nhờ bước gộp cụm nhỏ dưới 2 giây và cách ghép tối ưu, độ đúng theo thời gian vẫn giữ ở mức 85–95%, tức là phần lớn lời nói vẫn được gán đúng người; các "người thừa" chiếm ít thời lượng và người dùng có thể gộp lại khi gán tên.

Kết quả **phát hiện nói chồng là không đạt**. Trên bản ghi có 4 vùng nói chồng, mô-đun không gắn cờ đúng vùng nào; ngược lại, trên các bản ghi không hề có nói chồng, 8–11 đoạn vẫn bị gắn cờ. Nguyên nhân nằm ở thiết kế ngưỡng thích nghi (trung vị cộng hai lần độ lệch tuyệt đối trung vị của độ tương đồng với người nói thứ hai): ngưỡng tương đối luôn đẩy phần đuôi của phân bố lên thành cờ, kể cả khi không có nói chồng; trong khi các vùng nói chồng ngắn (1,2 giây) bị cửa sổ 1,5 giây làm loãng. Đây là phát hiện quan trọng của thực nghiệm: chức năng này cần thiết kế lại bằng mô hình phát hiện nói chồng chuyên dụng hoặc ngưỡng tuyệt đối được hiệu chỉnh trên dữ liệu thật, và trước mắt không nên hiển thị cờ "nói chồng" cho người dùng như một tín hiệu tin cậy. Theo kết quả này, cờ đã được tắt mặc định trong hệ thống.

Về **hiện tượng ảo giác**, trong đoạn 8 giây chỉ có nhiễu nền, hệ thống không sinh ra đoạn văn bản nào. Kết quả này phù hợp với các biện pháp đã áp dụng (lọc khoảng lặng bằng VAD, bỏ đoạn bịa giữa khoảng lặng dài, không mượn ngữ cảnh câu trước, lọc câu rác thường gặp).

## Lựa chọn mô hình ngôn ngữ lớn

Nhóm thử tất cả các LLM mà khoá API được cấp quyền trên FPT AI Factory. Tám mô hình thuộc nhóm "bán lại" (Azure gpt-5.6, Google Gemini, Alibaba Qwen/DeepSeek Pro, Z.ai GLM-5.3, Minimax) trả lỗi 402 do tài khoản chưa nạp tiền cho nhóm này; các mô hình này đồng thời gửi dữ liệu ra ngoài hạ tầng FPT nên không được ưu tiên. Chín mô hình do FPT tự vận hành được đánh giá trên transcript chuẩn của kịch bản, cùng một prompt hệ thống, nhiệt độ 0,2. Năm mô hình tốt nhất ở lượt đầu được chạy lại ba lần để đánh giá độ ổn định. Kết quả ở [[tb-llm]] và [[fig-llm-models]].

::table tb-llm | So sánh các LLM trên bài trích xuất biên bản (transcript chuẩn, tối đa 15 điểm)
| Mô hình | Số lần chạy | Điểm từng lần | Trung bình | Thời gian TB (s) | Chi phí/lần (USD) |
|---|---|---|---|---|---|
| DeepSeek-V4.1-Flash | 3 | 15, 15, 15 | 15,0 | 74,1 | 0,0052 |
| GLM-5.2 | 3 | 15, 14, 15 | 14,7 | 5,2 | 0,0063 |
| gemma-4-31B-it | 3 | 14, 13, 13 | 13,3 | 4,8 | 0,0006 |
| Qwen3.8-27B | 3 | 13, 12, 14 | 13,0 | 27,8 | 0,0036 |
| gemma-4-26B-A4B-it | 1 | 12 | 12,0 | 3,3 | 0,0006 |
| Quyet-1.0-Large | 1 | 9 | 9,0 | 15,3 | 0,0001 |
| Llama-3.3-70B-Instruct | 1 | 9 | 9,0 | 22,5 | 0,0006 |
| gpt-oss-120b | 1 | 7 | 7,0 | 4,2 | 0,0007 |
| DeepSeek-V4-Flash | 3 | 0, 0, 15 | 5,0 | 32,3 | 0,0024 |

::figure fig-llm-models | Độ đúng trích xuất và độ trễ của các LLM trên FPT AI Factory | 16

DeepSeek-V4.1-Flash là mô hình duy nhất đạt trọn 15/15 điểm ở cả ba lần chạy, không dính bẫy nào: nhận ra đề xuất Firebase chưa phải quyết định, lấy đúng hạn 18/11 sau đính chính, giao việc nhắc lịch cho Hùng thay vì Nam, bỏ qua chuyện bóng đá và suy ra "Người nói 4" là Phương. Đổi lại, đây là mô hình suy luận nên mất 45–90 giây mỗi lần. GLM-5.2 đạt gần tương đương (14,7) với thời gian chỉ khoảng 5 giây; lỗi duy nhất là một lần bỏ sót việc bị đổi người thực hiện. Các mô hình nhỏ hơn (gemma, Qwen 27B) thường bỏ sót các quyết định dạng phủ định ("chưa làm MoMo") hoặc công việc gắn với người chủ trì. Các mô hình đa năng thế hệ trước (Llama 3.3 70B, gpt-oss-120b) và mô hình tiếng Việt Quyet-1.0-Large bỏ sót nhiều công việc.

Thực nghiệm cũng phát hiện hai vấn đề kỹ thuật quan trọng cho việc tích hợp. Thứ nhất, khi bật chế độ ép đầu ra JSON (response_format), DeepSeek-V4.1-Flash trả về nội dung rỗng (toàn bộ đầu ra nằm ở phần suy luận) và DeepSeek-V4-Flash trả về cấu trúc gọi hàm lặp lại transcript; vì vậy hệ thống không dùng chế độ này mà tự bóc và kiểm tra JSON. Thứ hai, DeepSeek-V4-Flash không ổn định: hai trong ba lần chạy rơi vào vòng lặp sinh văn bản đến khi hết giới hạn token.

Từ kết quả trên, hệ thống chọn **DeepSeek-V4.1-Flash làm mô hình chính** vì độ chính xác và độ ổn định cao nhất, chi phí khoảng 0,005 USD (khoảng 130 đồng) mỗi cuộc họp; độ trễ một phút không ảnh hưởng vì phân tích chạy nền sau bước phiên âm. **GLM-5.2 làm mô hình dự phòng** khi mô hình chính lỗi, quá thời gian hoặc trả JSON hỏng. Cả hai đều do FPT tự vận hành, dữ liệu cuộc họp không rời hạ tầng trong nước.

## Đánh giá đầu-cuối từ âm thanh đến công việc

Ở thực nghiệm này, transcript do Whisper nhận dạng và mô-đun tách người nói gán nhãn được đưa thẳng vào bộ phân tích với mô hình đã chọn, đúng như luồng chạy thật. Mỗi transcript được phân tích hai lần: với nhãn tự động ("Người nói 1…4") và với tên thật được gán theo cách ghép người nói tốt nhất, mô phỏng thao tác "gán tên người nói" của người dùng trên giao diện. [[tb-e2e]] trình bày điểm nghiêm ngặt và điểm sau chuẩn hoá cách viết thứ trong tuần.

::table tb-e2e | Điểm trích xuất khi đầu vào là transcript do máy nhận dạng (tối đa 15)
| Điều kiện | Cấu hình STT | Nhãn tự động | Đã gán tên | Mô hình phân tích |
|---|---|---|---|---|
| Transcript chuẩn (đối chứng) | — | — | 15 / 15 | DeepSeek-V4.1-Flash |
| Sạch | small | 10 / 11 | 12 / 13 | DeepSeek-V4.1-Flash |
| Sạch | small + từ điển | 11 / 12 | 9 / 10 | DeepSeek-V4.1-Flash |
| Sạch | medium | 11 / 11 | 15 / 15 | DeepSeek-V4.1-Flash |
| Nhiễu trắng 20 dB | small | 10 / 11 | 10 / 11 | DeepSeek-V4.1-Flash |
| Nhiễu trắng 10 dB | small | 8 / 9 | 12 / 13 | DeepSeek-V4.1-Flash |
| Nhiễu trắng 10 dB | small + từ điển | 6 / 6 | 13 / 13 | DeepSeek-V4.1-Flash |
| Nhiễu trắng 10 dB | medium | 12 / 12 | 14 / 14 | DeepSeek-V4.1-Flash |
| Nhiễu trắng 5 dB | small | 5 / 5 | 8 / 8 | GLM-5.2 (dự phòng) |
| Đông người 10 dB | small | 8 / 9 | 11 / 12 | DeepSeek-V4.1-Flash |
| Đông người 10 dB | small + từ điển | 8 / 8 | 13 / 14 | DeepSeek-V4.1-Flash |
| Đông người 10 dB | medium | 12 / 12 | 13 / 13 | DeepSeek-V4.1-Flash |
| Nói chồng + đoạn nhiễu | small | 6 / 7 | 13 / 14 | DeepSeek-V4.1-Flash |

Ghi chú: mỗi ô dạng "nghiêm ngặt / sau chuẩn hoá cách viết thứ"; mỗi điều kiện chạy một lần.

Có ba nhận xét chính. Thứ nhất, so với 15/15 trên transcript chuẩn, điểm trên transcript máy giảm còn khoảng 8–13 điểm với Whisper small: lỗi nhận dạng lan sang bước trích xuất, đặc biệt ở các công việc gắn với thuật ngữ bị nghe sai (hạn "cuối tuần này" bị nghe thành "cuối tôm nay" nên công việc viết tài liệu mất thời hạn đúng). Thứ hai, **gán tên người nói giúp tăng điểm rõ rệt** (trung bình khoảng 3 điểm ở các điều kiện có nhiễu): khi chỉ có nhãn "Người nói 1…4", mô hình khó xác định ai nhận việc nếu câu giao việc không nêu tên. Điều này khẳng định giá trị của bước gán tên người nói; từ kết quả này, hệ thống được bổ sung thao tác "phân tích lại" để chạy lại AI sau khi người dùng gán tên. Thứ ba, chất lượng nhận dạng tốt hơn kéo theo trích xuất tốt hơn: với Whisper medium ở điều kiện sạch, hệ thống đạt lại 15/15 điểm khi đã gán tên.

Một quan sát đáng chú ý là LLM tự sửa được nhiều lỗi nhận dạng nhờ ngữ cảnh: transcript ghi "phai bây sơ", "EAS-MS", "so gơ", nhưng công việc được trích xuất lại ghi đúng "Firebase", "ESMS", "Swagger". Ngược lại, LLM không thể khôi phục thông tin đã mất hẳn (thời hạn bị nghe sai). Ở điều kiện nhiễu 5 dB, mô hình chính suy luận quá lâu nên cổng dịch vụ trả lỗi hết thời gian chờ (HTTP 524) và hệ thống tự chuyển sang GLM-5.2, chứng tỏ cơ chế dự phòng hoạt động đúng; đồng thời cho thấy cần chuyển lời gọi LLM sang chế độ truyền luồng. Sau thực nghiệm, lời gọi đã được chuyển sang chế độ luồng và kiểm chứng lại với cả hai mô hình trên API thật.

Các ô của [[tb-e2e]] chỉ chạy một lần nên chịu ảnh hưởng của tính ngẫu nhiên của LLM (ví dụ ô "small + từ điển, sạch, đã gán tên" chỉ đạt 9 điểm dù nhận dạng thuật ngữ tốt hơn); cần nhiều lần chạy hơn để so sánh các cấu hình STT với độ tin cậy thống kê.

## Thời gian xử lý, chi phí và hiệu quả tiết kiệm thời gian

### Thời gian xử lý

::figure fig-timing | Thời gian xử lý từng bước cho bản ghi 151 giây (CPU, không GPU) | 15

[[fig-timing]] và [[tb-time]] cho thấy với cấu hình mặc định, hệ thống xử lý bản ghi 151 giây trong khoảng 150 giây: phiên âm chiếm phần lớn (khoảng 106 giây), tách người nói chỉ khoảng 5 giây, phân tích LLM khoảng 41–45 giây. Hệ số thời gian thực của bước phiên âm và tách người nói là 0,73, tức là trên laptop không GPU, hệ thống xử lý nhanh hơn thời gian thực một chút. Với mô hình medium, riêng bước phiên âm mất 287 giây (RTF khoảng 1,9). Ngoại suy tuyến tính, một cuộc họp 60 phút cần khoảng 44 phút xử lý âm thanh với mô hình small hoặc khoảng 2 giờ với mô hình medium trên phần cứng này; trên máy chủ có GPU, thời gian này giảm nhiều lần. Vì toàn bộ xử lý chạy nền và bất đồng bộ, người dùng không phải chờ trước màn hình.

::table tb-time | Thời gian xử lý bản ghi 151 giây ở điều kiện sạch
| Bước | Whisper small | Whisper medium |
|---|---|---|
| Nạp mô hình (một lần mỗi tiến trình) | 1,8 s | 5,5 s |
| Phiên âm (2 lượt, nhận diện ngôn ngữ) | 105,6 s | 286,5 s |
| Tách người nói | 5,3 s | 5,0 s |
| Phân tích LLM (DeepSeek-V4.1-Flash) | 40,9–44,6 s | 21,1–33,9 s |
| Hệ số thời gian thực (phiên âm + tách người nói) | 0,73 | 1,93 |

### Chi phí

Chi phí LLM cho một lần phân tích bản họp thử nghiệm (khoảng 1.700 token đầu vào và 2.900–5.600 token đầu ra, phần lớn là token suy luận) là khoảng 0,004–0,007 USD. Với cuộc họp 60 phút (khoảng 15.000 token transcript), chi phí ước tính dưới 0,03 USD mỗi cuộc họp. Phiên âm và tách người nói chạy trên máy chủ của tổ chức nên không phát sinh chi phí API.

### Ước tính hiệu quả tiết kiệm thời gian

Đề tài chưa có điều kiện đo trên người dùng thật, vì vậy hiệu quả tiết kiệm thời gian dưới đây là **ước tính dựa trên giả định**, cần được kiểm chứng bằng nghiên cứu người dùng ở giai đoạn sau. Giả định cho một cuộc họp 60 phút của nhóm 4–6 người: không có hệ thống, thư ký vừa họp vừa ghi chép, sau họp mất khoảng 30 phút soạn biên bản và khoảng 10 phút tạo, giao công việc trên công cụ quản lý. Có hệ thống, máy tự xử lý nền; trưởng nhóm mất khoảng 10 phút rà soát biên bản nháp và duyệt các đề xuất, mỗi đề xuất đã có sẵn câu trích dẫn để đối chiếu nhanh.

::table tb-saving | Ước tính thời gian công sức con người cho một cuộc họp 60 phút
| Công việc | Không có hệ thống | Có MeetingMind |
|---|---|---|
| Ghi chép trong lúc họp | Một người ghi liên tục | Không cần (máy ghi âm hoặc đọc phụ đề) |
| Soạn biên bản sau họp | ~30 phút | ~5 phút rà soát bản nháp |
| Tạo và giao công việc | ~10 phút | ~5 phút duyệt đề xuất |
| Tổng thời gian sau họp | ~40 phút | ~10 phút |

Theo giả định này, mỗi cuộc họp tiết kiệm khoảng 30 phút công sức sau họp, và người ghi chép được giải phóng để tham gia thảo luận. Với nhóm họp 3 buổi mỗi tuần, mức tiết kiệm khoảng 1,5 giờ mỗi tuần. Thực nghiệm ở mục trước cũng cho thấy bản nháp không hoàn hảo (đặc biệt khi âm thanh kém), nên bước rà soát của con người là bắt buộc chứ không phải hình thức; thiết kế hàng đợi duyệt với câu trích dẫn đi kèm giúp bước này nhanh hơn so với đọc lại toàn bộ transcript.

## Đánh giá hỏi đáp tri thức

Câu hỏi thực nghiệm thứ bảy được trả lời bằng cách chấm chức năng hỏi đáp trên dữ liệu thật đã có trong hệ thống: cuộc họp sprint 12 dựng từ kịch bản ở trên và đã được hệ thống phiên âm, các công việc đã duyệt của cuộc họp và một tài liệu đính kèm, tất cả được lập chỉ mục qua đúng luồng sự kiện của hệ thống. Bộ chấm gồm 10 câu hỏi: 8 câu có đáp án, bám các tình huống dễ sai của kịch bản (hạn bị đính chính, đổi người thực hiện, đề xuất chưa được chốt, việc không làm trong sprint), và 2 câu nằm ngoài nội dung cuộc họp. Mỗi câu được gửi qua API hỏi đáp của core-service bằng tài khoản quản trị workspace, tức là đi qua đủ bước lọc quyền, truy xuất, xếp hạng lại và kiểm tra trích dẫn. Câu có đáp án được tính là đạt khi hệ thống không trả "chưa đủ thông tin", câu trả lời chứa từ khoá của đáp án và có ít nhất một trích dẫn; câu ngoài phạm vi đạt khi hệ thống trả "chưa đủ thông tin". Thời gian được đo phía máy khách cho trọn lượt gọi qua Core. Kết quả ở [[tb-rag-eval]].

::table tb-rag-eval | Kết quả chấm hỏi đáp tri thức trên cuộc họp sprint 12
| # | Câu hỏi (rút gọn) | Đáp án mong đợi | Kết quả | Số trích dẫn | Thời gian (s) |
|---|---|---|---|---|---|
| 1 | Nhóm chốt dùng cơ sở dữ liệu gì? | PostgreSQL | Đạt | 1 | 1,78 |
| 2 | Hạn bản đầu tích hợp VNPay? | 18/11 (đã đính chính từ 15/11) | Đạt | 2 | 1,47 |
| 3 | Ai làm thông báo nhắc lịch? | Hùng | Đạt | 4 | 1,75 |
| 4 | Sprint này có làm thanh toán MoMo? | Không, để sprint sau | Đạt | 2 | 1,58 |
| 5 | Ai phụ trách đăng nhập bằng OTP? | Nam | Đạt | 2 | 1,68 |
| 6 | Đã chốt Firebase hay eSMS? | Chưa chốt, đang so sánh | Đạt | 1 | 1,66 |
| 7 | Nâng gói máy chủ đã được duyệt chưa? | Chưa | Đạt | 4 | 1,65 |
| 8 | Cuộc họp tiếp theo khi nào? | Thứ Hai, 9 giờ | Đạt | 3 | 1,24 |
| 9 | Doanh thu quý 3 của công ty? | Ngoài phạm vi: "chưa đủ thông tin" | Đạt | 0 | 1,30 |
| 10 | Thời tiết Hà Nội hôm nay? | Ngoài phạm vi: "chưa đủ thông tin" | Đạt | 0 | 1,21 |

Cả 10 câu đều đạt. Ở 8 câu có đáp án, câu trả lời đúng và có từ một đến bốn trích dẫn trỏ về transcript, công việc hoặc tài liệu. Đáng chú ý là các câu chạm tới tình huống bẫy: hệ thống trả hạn VNPay là 18/11 và nêu rõ đó là thông tin sau khi đính chính từ 15/11; trả lời "chưa chốt" cho câu Firebase hay eSMS vì trong cuộc họp đây mới là đề xuất cần so sánh giá; trả lời việc nâng gói máy chủ chưa được duyệt. Hai câu ngoài phạm vi nhận đúng nguyên văn câu "Chưa đủ thông tin trong các cuộc họp bạn được xem để trả lời câu hỏi này.", không có thông tin bịa thêm. Như vậy quy tắc chống bịa và phân biệt đề xuất với quyết định đã đặt cho bộ phân tích biên bản cũng được giữ ở chức năng hỏi đáp.

Mỗi câu mất 1,21–1,78 giây, trung bình khoảng 1,5 giây. Theo nhật ký của ai-service, bước nhúng câu hỏi mất khoảng 0,2 giây, tìm kiếm trong pgvector khoảng 0,01 giây, còn phần lớn thời gian thuộc về LLM trả lời (khoảng 0,6–1,5 giây); với kho cỡ một workspace nhỏ, truy vấn vector có lọc quyền không phải là điểm nghẽn. Thời gian này phù hợp với tương tác hỏi – đáp trực tiếp, khác với phân tích biên bản chạy nền mất vài chục giây.

Phân quyền của hỏi đáp được kiểm tra bằng ba tình huống. Người không thuộc workspace gọi API hỏi đáp nhận mã 403. Thành viên workspace không được xem cuộc họp nào thấy danh sách nguồn rỗng, và câu hỏi của họ nhận câu trả lời "chưa đủ thông tin" mà không có lời gọi mô hình nào. Khi gọi thẳng ai-service với danh sách gồm cuộc họp khác, câu SQL trả về 0 dòng và mô hình không được gọi, xác nhận bộ lọc nằm ở tầng truy vấn chứ không chỉ ở Core. Bộ 10 câu trên chỉ dùng dữ liệu của một cuộc họp, nên nhóm xây thêm bộ chấm mở rộng trình bày dưới đây.

### Bộ chấm mở rộng: nhiều cuộc họp và phép thử rò rỉ quyền

Bộ chấm mở rộng thêm hai cuộc họp có đáp án thuộc hai dự án riêng: cuộc họp kế hoạch chiến dịch marketing Tết 2027 (dự án Marketing; ngân sách, kênh quảng cáo, người viết bài và hạn, hạn bộ nhận diện bị lùi từ 10/12 sang 15/12, đề xuất mời KOL chưa chốt, chuyện ngoài lề) và cuộc họp ban giám đốc về lương thưởng (dự án Ban giám đốc; thưởng Tết, quỹ thưởng, tỷ lệ tăng lương — nội dung nhạy cảm). Một tài khoản thử được tạo với vai trò thành viên chỉ của dự án Marketing; tài khoản này chỉ thấy đúng một cuộc họp marketing trong danh sách cuộc họp. Bộ chấm gồm 27 câu, chạy qua API của Core sau khi đã có lịch sử hội thoại phía máy chủ; với các câu của tài khoản thử, ngoài yêu cầu trả "chưa đủ thông tin", câu trả lời còn không được chứa bất kỳ chi tiết nào của cuộc họp ngoài quyền (con số thưởng, tỷ lệ tăng lương, tên người phụ trách, tên công nghệ) và mọi trích dẫn phải thuộc cuộc họp được phép.

::table tb-rag-eval2 | Kết quả bộ chấm hỏi đáp mở rộng (27 câu, ba cuộc họp, hai người dùng)
| Nhóm câu hỏi | Người hỏi | Số câu | Đạt | Ghi chú |
|---|---|---|---|---|
| Có đáp án, cuộc họp marketing | admin | 10 | 10 | Ngân sách 150 triệu, TikTok và Facebook (không Google Ads), Linh viết bài hạn 20/12, hạn bộ nhận diện 15/12 sau khi lùi, KOL chưa chốt… |
| Có đáp án, cuộc họp ban giám đốc | admin | 3 | 3 | Thưởng 2 tháng lương, quỹ 800 triệu, tăng lương 8% từ tháng 3/2027 |
| Có đáp án, cuộc họp sprint 12 | admin | 2 | 2 | Trích từ cuộc họp có cùng nội dung sprint 12 |
| Liên cuộc họp | admin | 1 | 1 | Gộp đúng PostgreSQL (sprint 12) và TikTok, Facebook (marketing) |
| Ngoài phạm vi | admin | 2 | 2 | Trả "chưa đủ thông tin" |
| Hỏi nối tiếp trong một hội thoại | admin | 2 | 2 | "Hạn của bạn ấy là ngày nào?" được hiểu là hạn của Tuấn: 15/12 |
| Câu được phép | chỉ dự án Marketing | 2 | 2 | Trả lời đúng, trích cuộc họp marketing |
| Phép thử rò rỉ (lương thưởng, sprint 12) | chỉ dự án Marketing | 5 | 5 | Đều "chưa đủ thông tin", không lộ chi tiết nào |
| **Tổng** | | **27** | **27** | Trung bình 1,75 s mỗi câu (0,99–4,41 s) |

Danh sách nguồn (notebook) của tài khoản thử chỉ có đúng một nguồn thuộc cuộc họp được phép, không lộ tiêu đề hay nội dung của các cuộc họp khác. Hai câu về sprint 12 trích dẫn từ một cuộc họp thử khác có cùng nội dung (bản phụ đề của cùng kịch bản), điều này đúng vì nội dung trùng nhau. Lần chạy đầu cho thấy câu trích dẫn của câu hạn VNPay chọn nhầm câu "ngày 15 tháng 11" trước khi người nói đính chính; cách chọn câu trích được sửa (ưu tiên câu chứa đúng con số trong câu trả lời, gộp câu đính chính) và câu trích sau khi sửa là "Chắc ngày 15 tháng 11 xong bản đầu. À không, ngày 18 đi chị…". Bộ chấm vẫn khớp theo từ khoá và dùng cuộc họp dựng theo kịch bản, nên chưa thay thế được đánh giá trên kho cuộc họp thật quy mô lớn.

## Kiểm thử chức năng hệ thống

Bên cạnh đánh giá độ chính xác, nhóm kiểm thử các kịch bản chức năng trên môi trường Docker Compose với dịch vụ thật (PostgreSQL, RabbitMQ, MinIO, ai-worker, ai-service, LLM qua FPT AI Factory, integration-service với tài khoản Trello và bot Telegram). Kết quả tóm tắt ở [[tb-e2e-scenarios]].

::table tb-e2e-scenarios | Kết quả các kịch bản kiểm thử chức năng
| Kịch bản | Các bước kiểm tra | Kết quả |
|---|---|---|
| Đường phụ đề trực tiếp | Mở phiên, đẩy 30 đoạn phụ đề, chốt phiên → phân tích LLM → biên bản nháp và hàng đợi duyệt | Đạt: biên bản nháp phiên bản 1, 16 đề xuất (8 công việc, 5 quyết định, 3 vấn đề mở), đúng các tình huống bẫy |
| Đường tải tệp ghi âm | Tạo cuộc họp, tải tệp WAV, phiên âm Whisper + tách người nói, phân tích LLM | Đạt (xem mô tả bên dưới) |
| Duyệt đề xuất | Duyệt, sửa, từ chối đề xuất trên giao diện → sinh công việc, quyết định chính thức | Đạt |
| Đồng bộ Trello và Telegram | Duyệt công việc "Viết tài liệu API bằng Swagger" → integration-service tạo thẻ Trello, gửi tin Telegram → Core lưu kết quả → giao diện | Đạt: sau 3,4 s có thẻ trên bảng "MeetingMind" (danh sách "Việc từ cuộc họp" do hệ thống tự tạo) và tin Telegram kèm đường dẫn thẻ; giao diện hiện liên kết "Trello" và nhãn "Đã báo Telegram". Khi chưa có khoá Trello: Trello `skipped`, Telegram vẫn gửi sau khoảng 2 s |
| Bot Google Meet | Mời bot bằng tài khoản Google riêng → vào phòng → chờ duyệt → ghi âm → tải lên | Một phần: bot vào phòng và nhận đúng trạng thái chờ duyệt; kịch bản ghi âm dài sau khi được cho vào chưa chạy trọn trong thời gian đề tài |
| Mô hình dự phòng | Mô hình chính bị cắt kết nối (lỗi 524) | Đạt: tự chuyển sang GLM-5.2, vẫn trả kết quả |
| Phân tích lại theo tên người nói | Gán "Người nói 1" cho một thành viên → phân tích lại | Đạt: lô đề xuất mới ghi người thực hiện bằng tên thành viên thay cho nhãn, mất khoảng 21–25 s |
| Gọi LLM theo luồng | Chạy lại bài trích xuất với mô hình chính và dự phòng ở chế độ luồng | Đạt: cả hai mô hình trả kết quả đúng định dạng |
| Hỏi đáp tri thức và phân quyền | Hỏi 10 câu, sau đó 27 câu với hai người dùng qua API của Core; người ngoài workspace gọi API; thành viên không được xem cuộc họp nào xem nguồn và đặt câu hỏi; gọi ai-service với danh sách cuộc họp khác | Đạt: 10/10 và 27/27 câu, không rò rỉ ở 5 phép thử; trung bình 1,5–1,8 s mỗi câu, chậm nhất 4,4 s; người ngoài nhận 403; thành viên không có quyền thấy danh sách nguồn rỗng và nhận "chưa đủ thông tin"; SQL trả 0 dòng, không gọi mô hình |
| Phân quyền | Truy cập API không đăng nhập, đổi mật khẩu sai mật khẩu cũ, tự đặt chủ sở hữu workspace, đọc ghi chú riêng qua tuyến CRUD | Đạt sau khi vá các lỗi phát hiện trong quá trình kiểm thử (tài khoản thường gọi `/note` nhận 403) |
| Kiểm thử đơn vị | pytest (ai-service, bot-worker), node test (extension), Jest (integration-service) | Đạt: 81 + 3 + 7 + 20 ca |

Kịch bản tải tệp ghi âm được chạy với bản ghi "nói chồng + đoạn nhiễu" (152 giây) qua đúng API của hệ thống: tạo cuộc họp trực tiếp, tải tệp lên MinIO, Core phát lệnh phiên âm, ai-worker phiên âm và tách người nói, Core lưu transcript phiên bản 1 (42 đoạn, 5 nhãn người nói) rồi phát lệnh phân tích, ai-worker gọi LLM, Core tạo biên bản nháp cùng hàng đợi duyệt gồm 8 công việc, 4 quyết định và 3 vấn đề còn mở. Hai lần chạy mất 171 giây và 148 giây từ lúc tải tệp đến khi có biên bản nháp. Lần chạy đầu phát hiện một lỗi: cuộc họp trực tiếp tạo bằng đường tải tệp vẫn ở trạng thái "đã lên lịch" sau khi có transcript, khiến giao diện ẩn tab transcript; lỗi được sửa bằng cách chuyển cuộc họp sang "đã kết thúc" khi nhận transcript từ bản ghi. Kết quả phản ánh đúng các hạn chế đã đo: vài lỗi nhận dạng còn trong transcript, và vì người nói chưa được gán tên nên hai công việc mang nhãn "Người nói 1", "Người nói 4" thay vì tên thật, đúng như phân tích ở mục đánh giá đầu-cuối. Dữ liệu của kịch bản này được dùng cho các ảnh chụp giao diện ở chương Xây dựng hệ thống.

Kịch bản đồng bộ được chạy với tài khoản Trello và bot Telegram thật của nhóm. Ở lần duyệt đầu, khi chưa cấu hình khoá Trello, integration-service trả về Trello `skipped` (không gọi API) và Telegram `synced`, tin đến sau khoảng 2 giây; Core lưu kết quả và giao diện hiển thị đúng trạng thái. Sau khi cấu hình khoá Trello, duyệt công việc "Viết tài liệu API bằng Swagger" thì sau 3,4 giây thẻ được tạo trên bảng "MeetingMind", trong danh sách "Việc từ cuộc họp" do hệ thống tự tạo, tin Telegram kèm đường dẫn thẻ được gửi, Core lưu Trello `synced` (có đường dẫn thẻ) và Telegram `synced`. Kịch bản này xác nhận trọn chuỗi duyệt → outbox → RabbitMQ → integration-service → Trello, Telegram → Core → giao diện; các tình huống mất phản hồi và lỗi của một bên được kiểm tra bằng kiểm thử đơn vị.

## Hạn chế của thực nghiệm

Kết quả trên cần được đọc cùng các hạn chế sau. Thứ nhất, dữ liệu được dựng bằng giọng tổng hợp từ một kịch bản: giọng tổng hợp rõ và đều hơn giọng thật nhưng đọc thuật ngữ tiếng Anh theo phát âm tiếng Việt, nên WER trên cuộc họp thật có thể cao hơn ở phần tiếng Việt và thấp hơn ở phần thuật ngữ. Thứ hai, quy mô nhỏ: một kịch bản, bốn người nói, mỗi điều kiện âm thanh chạy một lần, nên chênh lệch vài điểm giữa các cấu hình chưa có ý nghĩa thống kê. Thứ ba, bộ chấm trích xuất khớp theo từ khoá, có thể chấm thiếu những đầu ra đúng nghĩa nhưng diễn đạt khác. Thứ tư, chưa có giọng tiếng Anh tự nhiên để đánh giá nhận diện ngôn ngữ trên hội thoại xen Việt – Anh; cơ chế này mới được kiểm tra bằng kiểm thử đơn vị. Thứ năm, hiệu quả tiết kiệm thời gian mới là ước tính. Thứ sáu, đánh giá hỏi đáp tri thức dùng 37 câu hỏi trên ba cuộc họp dựng theo kịch bản, đủ cho thấy chức năng và bộ lọc quyền hoạt động đúng trên các tình huống chính, nhưng chưa đủ để ước lượng độ chính xác trên kho hàng trăm cuộc họp thật. Hướng khắc phục là thu thập một bộ ghi âm cuộc họp thật có sự đồng ý của người tham gia, gán nhãn thủ công và lặp lại toàn bộ quy trình đánh giá đã xây dựng.

## Kết luận chương

Thực nghiệm cho thấy các thành phần AI của MeetingMind đạt mức dùng được cho mục đích hỗ trợ ghi biên bản, với con người rà soát ở bước cuối. LLM được chọn (DeepSeek-V4.1-Flash) trích xuất đúng hoàn toàn trên transcript chuẩn và ổn định qua các lần chạy, với chi phí không đáng kể. Tách người nói hoạt động tốt ở điều kiện sạch và chấp nhận được khi có nhiễu. Khâu yếu nhất là nhận dạng tiếng nói với mô hình nhỏ trên CPU, đặc biệt với thuật ngữ tiếng Anh; lỗi ở khâu này lan sang khâu trích xuất. Các giải pháp đã được kiểm chứng định lượng gồm dùng mô hình lớn hơn (WER giảm từ 21,7% xuống 14,7%), từ điển thuật ngữ theo dự án (thuật ngữ đúng tăng từ 2 lên 11/24) và gán tên người nói trước khi phân tích. Chức năng đánh dấu nói chồng chưa đạt và cần thiết kế lại. Hỏi đáp tri thức đạt cả 10 câu của bộ chấm đầu và 27 câu của bộ chấm mở rộng trên ba cuộc họp, trung bình dưới 2 giây mỗi câu: câu có đáp án đều đúng và kèm trích nguồn, câu ngoài phạm vi được trả "chưa đủ thông tin" thay vì bịa, câu hỏi nối tiếp hiểu đúng ngữ cảnh lưu phía máy chủ; người dùng chỉ thuộc một dự án không đọc được bất kỳ chi tiết nào của cuộc họp ngoài quyền. Về chức năng, các kịch bản đầu-cuối đều đạt, trừ kịch bản ghi âm dài của bot chưa chạy trọn; luồng đồng bộ Trello và Telegram đã chạy với tài khoản thật.
