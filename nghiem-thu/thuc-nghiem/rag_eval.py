"""Chấm hỏi đáp tri thức qua API thật của Core (đã lọc quyền theo người hỏi).

Bộ câu hỏi bám kịch bản cuộc họp sprint 12 đã có trong hệ thống; mỗi câu có từ
khoá đáp án (đủ một trong các nhóm) hoặc phải trả "chưa đủ thông tin".
  python rag_eval.py
"""

import json
import sys
import time
import unicodedata

import requests

API = "http://localhost:3010"

CASES = [
    ("Nhóm chốt dùng cơ sở dữ liệu gì?", [["postgres"]]),
    ("Hạn hoàn thành bản đầu tích hợp VNPay là ngày nào?", [["18"]]),
    ("Ai làm phần thông báo nhắc lịch?", [["hùng"]]),
    ("Sprint này có làm thanh toán MoMo không?", [["chưa", "sprint sau", "không"]]),
    ("Ai phụ trách đăng nhập bằng OTP?", [["nam"]]),
    ("Đã chốt dùng Firebase hay eSMS cho OTP chưa?", [["chưa", "so sánh"]]),
    ("Việc nâng gói máy chủ đã được duyệt chưa?", [["chưa", "tuấn", "trình"]]),
    ("Cuộc họp tiếp theo diễn ra khi nào?", [["thứ hai", "thứ 2"], ["9"]]),
    ("Doanh thu quý 3 của công ty là bao nhiêu?", None),
    ("Thời tiết Hà Nội hôm nay thế nào?", None),
]


def norm(s: str) -> str:
    return unicodedata.normalize("NFC", s).lower()


def main():
    s = requests.Session()
    tok = s.post(API + "/auth/login", json={"username": "admin", "password": "admin", "platform": "Web"}).json()
    s.headers["Authorization"] = "Bearer " + tok.get("data", tok)["accessToken"]
    wss = s.get(API + "/me/workspaces").json()
    wss = wss.get("data", wss)
    ws = (wss if isinstance(wss, list) else wss.get("items"))[0]
    ws_id = ws.get("_id") or ws.get("id")
    ok = 0
    rows = []
    for question, expect in CASES:
        t = time.time()
        r = s.post(API + "/workflow/knowledge/ask", headers={"x-workspace-id": ws_id}, json={"workspaceId": ws_id, "question": question}, timeout=120)
        dt = time.time() - t
        body = r.json()
        d = body.get("data", body)
        if r.status_code >= 400:
            print("LỖI", r.status_code, json.dumps(body, ensure_ascii=False)[:300])
            sys.exit(1)
        text = norm(d.get("answer", "") + " " + " ".join(d.get("list") or []))
        cites = d.get("citations") or []
        if expect is None:
            passed = bool(d.get("insufficient"))
        else:
            passed = (not d.get("insufficient")) and all(any(k in text for k in group) for group in expect) and len(cites) > 0
        ok += passed
        rows.append({"question": question, "passed": passed, "seconds": round(dt, 2), "insufficient": d.get("insufficient"), "citations": len(cites), "model": d.get("model"), "answer": d.get("answer")})
        print(f"{'ĐẠT ' if passed else 'TRƯỢT'} {dt:5.2f}s cites={len(cites)} | {question} → {d.get('answer','')[:140]}")
    print(f"\nTổng: {ok}/{len(CASES)}")
    json.dump(rows, open("rag_eval_result.json", "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
