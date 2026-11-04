"""Benchmark các model FPT AI Factory cho bài phân tích cuộc họp tiếng Việt.

Chạy: set -a; . ./.env; set +a; python3 bench.py [model ...]
"""

import concurrent.futures as cf
import json
import os
import re
import sys
import time
import unicodedata

import requests

BASE = "https://token-api.fpt.ai/v1"
KEY = os.environ["FPT_AI_API_KEY"]
HERE = os.path.dirname(os.path.abspath(__file__))

TRANSCRIPT = [
    ("Lan", "Ok mọi người, hôm nay mình chốt phạm vi sprint 12 cho app đặt lịch phòng khám nhé. Có ba việc chính: đăng nhập, thanh toán, và thông báo nhắc lịch."),
    ("Nam", "Phần đăng nhập em làm xong API đăng ký rồi, còn đăng nhập bằng số điện thoại với OTP."),
    ("Hùng", "Hay là mình dùng luôn Firebase Auth cho OTP, đỡ phải tự làm?"),
    ("Lan", "Firebase thì tiền SMS ở Việt Nam hơi cao, để Nam tìm hiểu thêm giá rồi tính."),
    ("Nam", "Vâng, em so sánh Firebase với eSMS rồi báo lại chị trước thứ Tư."),
    ("Người nói 4", "Về database thì team mình thống nhất PostgreSQL chứ? Em thấy MongoDB hơi khó làm báo cáo."),
    ("Lan", "Ừ, chốt PostgreSQL nhé, không bàn lại nữa."),
    ("Hùng", "Ok, PostgreSQL."),
    ("Lan", "Thanh toán thì sao Hùng?"),
    ("Hùng", "Em đang tích hợp VNPay sandbox. Chắc ngày 15 tháng 11 xong bản đầu. À không, ngày 18 đi chị, vì hôm 15 em phải đi bảo vệ đồ án."),
    ("Lan", "Ok 18/11 nhé. Nhớ viết test cho phần callback."),
    ("Người nói 4", "Có cần hỗ trợ MoMo luôn không chị?"),
    ("Lan", "MoMo chưa, khách chưa yêu cầu. Để sprint sau tính."),
    ("Nam", "Còn phần thông báo nhắc lịch thì ai làm ạ?"),
    ("Lan", "Ban đầu chị định giao Nam, nhưng Nam đang ôm đăng nhập rồi. Thôi để Hùng làm phần nhắc lịch sau khi xong thanh toán."),
    ("Hùng", "Dạ được, nhưng em cần biết gửi qua Zalo hay SMS."),
    ("Lan", "Cái đó chị chưa hỏi khách. Chị sẽ hỏi bên phòng khám rồi báo lại."),
    ("Nam", "By the way, the design team said the new mockups will be ready next Monday."),
    ("Lan", "Great, then let's review the mockups together on Tuesday afternoon."),
    ("Hùng", "Hôm qua mọi người xem bóng đá không, Việt Nam thắng 2-0 đấy."),
    ("Nam", "Có, đá hay quá, chắc phải đi ăn mừng."),
    ("Lan", "Thôi quay lại việc. Một vấn đề nữa là ngân sách server. Hiện đang dùng gói 2 triệu một tháng, chắc không đủ khi có thanh toán."),
    ("Người nói 4", "Em nghĩ phải lên gói 5 triệu, nhưng cần sếp duyệt."),
    ("Lan", "Ừ, cái này chưa quyết được, để chị trình anh Tuấn."),
    ("Nam", "Em có thể tối ưu lại query trước, biết đâu không cần nâng gói."),
    ("Lan", "Tốt, Nam thử xem, nhưng ưu tiên OTP trước."),
    ("Người nói 4", "Em viết tài liệu API bằng Swagger cho cả team nhé, cuối tuần này em gửi."),
    ("Lan", "Ok cảm ơn em. Vậy tổng kết: Nam lo OTP, Hùng lo thanh toán rồi nhắc lịch, Phương lo tài liệu API."),
    ("Người nói 4", "Dạ."),
    ("Lan", "Cuộc họp sau vào thứ Hai tuần sau, 9 giờ sáng. Hết."),
]

SYSTEM = """Bạn là thư ký cuộc họp. Đọc transcript và trích xuất biên bản dưới dạng JSON.

Transcript gồm các dòng "[số thứ tự] Người nói: lời nói". Tên người nói có thể là tên thật hoặc nhãn tự động như "Người nói 2".

Quy tắc:
- Viết bằng ngôn ngữ chính của cuộc họp (thường là tiếng Việt), kể cả khi có câu xen tiếng Anh.
- Quyết định (decisions): chỉ những điều cả nhóm đã chốt. Một đề xuất chưa ai đồng ý ("hay là…", "em nghĩ…") KHÔNG phải quyết định.
- Vấn đề còn mở (openIssues): câu hỏi hoặc lựa chọn chưa có kết luận trong cuộc họp.
- Công việc (actionItems): việc cụ thể có người nhận làm hoặc được giao.
  - assigneeHint: tên người thực hiện đúng như trong transcript. Nếu người nói chỉ có nhãn tự động nhưng được gọi tên ở chỗ khác thì dùng tên đó. Không rõ ai làm thì để null.
  - deadlineRawText: nguyên văn cụm chỉ thời hạn trong transcript (ví dụ "thứ Sáu", "18/11"). Không có thì null. Không tự đoán ngày.
  - priority: "high" | "medium" | "low".
  - confidence: 0–1, mức chắc chắn đây là việc thật được giao.
- Nếu sau đó có người đính chính (đổi hạn, đổi người làm, huỷ việc) thì lấy thông tin cuối cùng.
- Bỏ qua chuyện ngoài lề không liên quan công việc.
- quote: trích NGUYÊN VĂN một đoạn ngắn trong đúng dòng có số thứ tự transcriptSequence làm bằng chứng.
- Không bịa thông tin không có trong transcript.

Chỉ trả về một object JSON, không kèm giải thích:
{
  "summary": "tóm tắt 3–5 câu",
  "decisions": [{"title": "", "description": "", "quote": "", "transcriptSequence": 0}],
  "openIssues": [""],
  "actionItems": [{"title": "", "description": "", "assigneeHint": null, "deadlineRawText": null, "priority": "medium", "confidence": 0.8, "quote": "", "transcriptSequence": 0}]
}"""


def user_prompt() -> str:
    lines = [f"[{i}] {speaker}: {text}" for i, (speaker, text) in enumerate(TRANSCRIPT)]
    return "Transcript cuộc họp:\n\n" + "\n".join(lines)


def call(model: str, use_rf: bool = True) -> dict:
    body = {
        "model": model,
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user_prompt()}],
        "temperature": 0.2,
        "max_tokens": 8000,
    }
    if use_rf:
        body["response_format"] = {"type": "json_object"}
    t = time.time()
    r = requests.post(
        f"{BASE}/chat/completions",
        headers={"Authorization": f"Bearer {KEY}"},
        json=body,
        timeout=600,
    )
    elapsed = time.time() - t
    out = {"model": model, "status": r.status_code, "seconds": round(elapsed, 1)}
    try:
        data = r.json()
    except ValueError:
        out["error"] = r.text[:500]
        return out
    if r.status_code != 200:
        out["error"] = json.dumps(data, ensure_ascii=False)[:500]
        return out
    msg = data["choices"][0]["message"]
    out["finish"] = data["choices"][0].get("finish_reason")
    out["content"] = msg.get("content")
    out["usage"] = data.get("usage")
    return out


def parse(content: str | None):
    if not content:
        return None
    s = content.strip()
    s = re.sub(r"^```(?:json)?\s*|\s*```$", "", s)
    try:
        return json.loads(s)
    except ValueError:
        m = re.search(r"\{.*\}", s, re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except ValueError:
                return None
    return None


def norm(s) -> str:
    return unicodedata.normalize("NFC", str(s or "")).lower()


def blob(item: dict) -> str:
    return norm(" ".join(str(item.get(k) or "") for k in ("title", "description")))


def score(result: dict) -> dict:
    """Chấm theo đáp án: mỗi ý đúng +1, mỗi bẫy dính -1."""
    items = result.get("actionItems") or []
    decisions = result.get("decisions") or []
    issues = [norm(x if isinstance(x, str) else json.dumps(x, ensure_ascii=False)) for x in result.get("openIssues") or []]
    notes: list[str] = []
    pts = 0

    def find(pred):
        return [it for it in items if isinstance(it, dict) and pred(it)]

    def who(it):
        return norm(it.get("assigneeHint"))

    def dl(it):
        return norm(it.get("deadlineRawText"))

    checks = {
        "A1 Nam so sánh Firebase/eSMS, trước thứ Tư": lambda: any("nam" in who(i) and "tư" in dl(i) for i in find(lambda i: "esms" in blob(i) or "so sánh" in blob(i) or "giá" in blob(i))),
        "A2 Nam làm OTP": lambda: bool(find(lambda i: "otp" in blob(i) and "nam" in who(i) and "esms" not in blob(i))) or bool(find(lambda i: "otp" in blob(i) and "nam" in who(i))),
        "A3 Hùng VNPay hạn 18/11": lambda: any("hùng" in who(i) and "18" in dl(i) for i in find(lambda i: "vnpay" in blob(i) or "thanh toán" in blob(i))),
        "A4 Hùng làm nhắc lịch": lambda: any("hùng" in who(i) for i in find(lambda i: "nhắc lịch" in blob(i) and "zalo" not in norm(i.get("title")))),
        "A5 Lan hỏi phòng khám Zalo/SMS": lambda: any("lan" in who(i) for i in find(lambda i: "zalo" in blob(i) or "phòng khám" in blob(i) or "hỏi" in blob(i))),
        "A6 Lan trình anh Tuấn ngân sách": lambda: any("lan" in who(i) for i in find(lambda i: "tuấn" in blob(i) or "ngân sách" in blob(i))),
        "A7 Nam tối ưu query": lambda: any("nam" in who(i) for i in find(lambda i: "query" in blob(i) or "truy vấn" in blob(i))),
        "A8 Phương viết Swagger, cuối tuần": lambda: any(("phương" in who(i) or "người nói 4" in who(i)) and "cuối tuần" in dl(i) for i in find(lambda i: "swagger" in blob(i) or "tài liệu api" in blob(i))),
        "A8+ gán đúng tên Phương": lambda: any("phương" in who(i) for i in find(lambda i: "swagger" in blob(i) or "tài liệu api" in blob(i))),
        "D1 chốt PostgreSQL": lambda: any("postgres" in blob(d) for d in decisions if isinstance(d, dict)),
        "D2 MoMo để sprint sau": lambda: any("momo" in blob(d) for d in decisions if isinstance(d, dict)),
        "O1 Firebase/eSMS còn mở": lambda: any("firebase" in x or "esms" in x or "otp" in x for x in issues),
        "O2 Zalo hay SMS còn mở": lambda: any("zalo" in x for x in issues),
        "O3 ngân sách server còn mở": lambda: any("ngân sách" in x or "server" in x or "gói" in x for x in issues),
        "Tóm tắt bằng tiếng Việt": lambda: bool(re.search(r"[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệịỉĩọỏốồổỗộớờởỡợụủũứừửữựỳỷỹý]", norm(result.get("summary")))),
    }
    for name, fn in checks.items():
        try:
            ok = fn()
        except Exception:  # noqa: BLE001
            ok = False
        pts += 1 if ok else 0
        if not ok:
            notes.append("thiếu " + name)

    traps = {
        "VNPay hạn 15/11 (chưa đính chính)": lambda: any("15" in dl(i) and "18" not in dl(i) for i in find(lambda i: "vnpay" in blob(i) or "thanh toán" in blob(i))),
        "Nam làm nhắc lịch": lambda: any("nam" in who(i) and "hùng" not in who(i) for i in find(lambda i: "nhắc lịch" in blob(i) and "zalo" not in blob(i))),
        "MoMo thành công việc": lambda: bool(find(lambda i: "momo" in blob(i))),
        "Bóng đá thành công việc": lambda: bool(find(lambda i: "bóng" in blob(i) or "ăn mừng" in blob(i))),
        "Firebase thành quyết định": lambda: any("firebase" in blob(d) and "không" not in blob(d) and "chưa" not in blob(d) for d in decisions if isinstance(d, dict)),
        "Nâng gói 5 triệu thành quyết định": lambda: any("5 triệu" in blob(d) or "nâng gói" in blob(d) for d in decisions if isinstance(d, dict)),
        "Bịa hạn cho OTP/nhắc lịch/hỏi khách": lambda: any(
            dl(i) and dl(i) not in ("null", "none")
            for i in find(lambda i: ("nhắc lịch" in blob(i) and "zalo" not in blob(i)) or ("phòng khám" in blob(i)) or ("otp" in blob(i) and "esms" not in blob(i) and "so sánh" not in blob(i)))
            if "18" not in dl(i) and "tư" not in dl(i)
        ),
    }
    for name, fn in traps.items():
        try:
            hit = fn()
        except Exception:  # noqa: BLE001
            hit = False
        if hit:
            pts -= 1
            notes.append("BẪY " + name)

    # Trích dẫn có thật trong đúng dòng không.
    grounded = total = 0
    for it in list(items) + list(decisions):
        if not isinstance(it, dict):
            continue
        total += 1
        seq = it.get("transcriptSequence")
        quote = norm(it.get("quote")).strip(" .\"'…")
        if isinstance(seq, int) and 0 <= seq < len(TRANSCRIPT) and quote and quote in norm(TRANSCRIPT[seq][1]):
            grounded += 1
    return {"points": pts, "max": len(checks), "grounded": f"{grounded}/{total}", "notes": notes}


def price(model: str, usage: dict | None, prices: dict) -> float | None:
    if not usage or model not in prices:
        return None
    p = prices[model]
    return usage.get("prompt_tokens", 0) * p[0] + usage.get("completion_tokens", 0) * p[1]


def main():
    models = sys.argv[1:]
    prices = {}
    try:
        cat = json.load(open(os.path.join(HERE, "..", "models.json")))["data"]
        prices = {m["id"]: (float(m["pricing"]["prompt"]), float(m["pricing"]["completion"])) for m in cat}
    except OSError:
        pass
    outdir = os.path.join(HERE, "out")
    os.makedirs(outdir, exist_ok=True)
    with cf.ThreadPoolExecutor(max_workers=6) as pool:
        runs = int(os.environ.get("BENCH_RUNS", "1"))
        no_rf = set(os.environ.get("BENCH_NO_RF", "Quyet-1.0-Large").split(","))
        futs = {pool.submit(call, m, m not in no_rf): (m, k) for m in models for k in range(runs)}
        for f in cf.as_completed(futs):
            m, k = futs[f]
            try:
                r = f.result()
            except Exception as e:  # noqa: BLE001
                print(f"{m:42} EXC {e}")
                continue
            parsed = parse(r.get("content"))
            r["parsed"] = parsed
            r["score"] = score(parsed) if isinstance(parsed, dict) else None
            r["cost"] = price(m, r.get("usage"), prices)
            fname = re.sub(r"[^A-Za-z0-9.-]", "_", m)
            json.dump(r, open(os.path.join(outdir, f"{fname}.{k}.json"), "w"), ensure_ascii=False, indent=1)
            u = r.get("usage") or {}
            sc = r["score"]
            print(
                f"{m:42} http={r['status']} {r['seconds']:6.1f}s finish={r.get('finish')} "
                f"tok={u.get('prompt_tokens')}/{u.get('completion_tokens')} "
                f"cost=${(r['cost'] or 0):.4f} "
                + (f"score={sc['points']}/{sc['max']} grounded={sc['grounded']}" if sc else f"PARSE_FAIL {(r.get('error') or (r.get('content') or '')[:200])!r}"),
                flush=True,
            )
            if sc and sc["notes"]:
                print("    " + "; ".join(sc["notes"]), flush=True)


if __name__ == "__main__":
    main()
