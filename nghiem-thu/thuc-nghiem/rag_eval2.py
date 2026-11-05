"""Bộ chấm hỏi đáp tri thức mở rộng: đáp án, ngoài phạm vi, hỏi nối tiếp và rò rỉ quyền.

Chạy sau rag_seed.py. Kết quả: rag_eval2_result.json.
"""

import json
import time
import unicodedata

import requests

API = "http://localhost:3010"
SEED = json.load(open("rag_seed.json"))
WS = SEED["workspaceId"]
M = SEED["meetings"]
INSUFFICIENT = "chưa đủ thông tin"

# (người hỏi, câu hỏi, nhóm từ khoá phải có [mỗi nhóm khớp một từ], từ cấm, cuộc họp phải được trích, cờ)
CASES = [
    # admin — cuộc họp marketing
    ("admin", "Ngân sách chiến dịch marketing Tết là bao nhiêu?", [["150"]], [], "marketing", ""),
    ("admin", "Chiến dịch Tết chạy quảng cáo trên những kênh nào?", [["tiktok"], ["facebook"]], [], "marketing", ""),
    ("admin", "Chiến dịch Tết có chạy Google Ads không?", [["không"]], [], "marketing", ""),
    ("admin", "Ai viết các bài đăng cho chiến dịch Tết và hạn nộp khi nào?", [["linh"], ["20"]], [], "marketing", ""),
    ("admin", "Hạn hoàn thành bộ nhận diện hình ảnh Tết là ngày nào?", [["15"]], [], "marketing", ""),
    ("admin", "Đã chốt mời KOL cho chiến dịch Tết chưa?", [["chưa"]], [], "marketing", ""),
    ("admin", "Ai phụ trách lấy báo giá KOL?", [["quân"]], [], "marketing", ""),
    ("admin", "Quảng cáo TikTok bắt đầu chạy từ khi nào?", [["1/1", "1 tháng 1", "01/01", "ngày 1"]], [], "marketing", ""),
    ("admin", "Mục tiêu bao nhiêu lượt đặt lịch mới trong tháng Tết?", [["3.000", "3000", "3 000"]], [], "marketing", ""),
    ("admin", "Cuộc họp marketing tiếp theo diễn ra khi nào?", [["thứ năm", "thứ 5"], ["14"]], [], "marketing", ""),
    # admin — ban giám đốc (admin được xem)
    ("admin", "Thưởng Tết năm nay cho nhân viên chính thức là bao nhiêu tháng lương?", [["2 tháng", "hai tháng"]], [], "bgd", ""),
    ("admin", "Quỹ thưởng Tết năm nay là bao nhiêu?", [["800"]], [], "bgd", ""),
    ("admin", "Năm sau tăng lương bao nhiêu phần trăm và từ khi nào?", [["8"], ["tháng 3", "3/2027"]], [], "bgd", ""),
    # admin — sprint 12
    ("admin", "Ai phụ trách đăng nhập bằng OTP?", [["nam"]], [], "sprint", ""),
    ("admin", "Hạn bản đầu tích hợp VNPay là ngày nào?", [["18"]], [], "sprint", ""),
    # admin — liên cuộc họp
    ("admin", "Các cuộc họp đã chốt dùng cơ sở dữ liệu gì và chạy quảng cáo trên kênh nào?", [["postgres"], ["tiktok"]], [], None, ""),
    # admin — ngoài phạm vi
    ("admin", "Giá Bitcoin hôm nay là bao nhiêu?", None, [], None, ""),
    ("admin", "Ai đang là tổng thống Mỹ?", None, [], None, ""),
    # admin — hỏi nối tiếp trong cùng hội thoại (ngữ cảnh lưu phía server)
    ("admin", "Ai làm bộ nhận diện hình ảnh Tết?", [["tuấn"]], [], "marketing", "thread-start"),
    ("admin", "Hạn của bạn ấy là ngày nào?", [["15"]], [], "marketing", "thread-follow"),
    # người dùng thử chỉ thuộc dự án Marketing
    ("user", "Ngân sách chiến dịch marketing Tết là bao nhiêu?", [["150"]], [], "marketing", ""),
    ("user", "Ai viết các bài đăng cho chiến dịch Tết?", [["linh"]], [], "marketing", ""),
    ("user", "Thưởng Tết năm nay là bao nhiêu tháng lương?", None, ["2 tháng", "hai tháng", "800", "lương"], None, "leak"),
    ("user", "Quỹ thưởng Tết năm nay là bao nhiêu?", None, ["800"], None, "leak"),
    ("user", "Công ty có tăng lương năm sau không?", None, ["8 phần trăm", "8%", "tháng 3"], None, "leak"),
    ("user", "Ai phụ trách đăng nhập bằng OTP?", None, ["nam phụ trách", "otp do nam"], None, "leak"),
    ("user", "Nhóm chốt dùng cơ sở dữ liệu gì?", None, ["postgres"], None, "leak"),
]


def norm(s):
    return unicodedata.normalize("NFC", s or "").lower()


def session(username, password):
    s = requests.Session()
    r = s.post(API + "/auth/login", json={"username": username, "password": password, "platform": "Web"}).json()
    s.headers["Authorization"] = "Bearer " + r.get("data", r)["accessToken"]
    s.headers["x-workspace-id"] = WS
    return s


def main():
    who = {"admin": session("admin", "admin"), "user": session(SEED["user"]["username"], SEED["user"]["password"])}
    allowed_user = {M["marketing"]}
    results, thread = [], None
    for actor, q, expect, banned, meeting, flag in CASES:
        body = {"workspaceId": WS, "question": q}
        if flag == "thread-follow" and thread:
            body["threadId"] = thread
        t = time.time()
        r = who[actor].post(API + "/workflow/knowledge/ask", json=body, timeout=120)
        dt = time.time() - t
        d = r.json()
        d = d.get("data", d)
        if flag == "thread-start":
            thread = d.get("threadId")
        text = norm((d.get("answer") or "") + " " + " ".join(d.get("list") or []))
        cites = d.get("citations") or []
        cited = {c.get("meetingId") for c in cites}
        checks = []
        if r.status_code >= 400:
            checks.append(f"HTTP {r.status_code}")
        if expect is None:
            if not d.get("insufficient"):
                checks.append("phải trả 'chưa đủ thông tin'")
        else:
            if d.get("insufficient"):
                checks.append("trả 'chưa đủ thông tin' sai")
            for group in expect:
                if not any(k in text for k in group):
                    checks.append(f"thiếu {group}")
            if not cites:
                checks.append("không có trích dẫn")
            # Nội dung sprint 12 có ở vài cuộc họp thử (bản chữ, bản ghi âm): trích
            # cuộc họp nào trong số đó cũng đúng, chỉ cần đúng tên cuộc họp.
            if meeting == "sprint":
                if not any("sprint 12" in norm(c.get("meetingTitle")) or "fpt llm" in norm(c.get("meetingTitle")) for c in cites):
                    checks.append("không trích cuộc họp sprint 12")
            elif meeting and M[meeting] not in cited:
                checks.append(f"không trích cuộc họp {meeting}")
        for b in banned:
            if norm(b) in text:
                checks.append(f"LỘ '{b}'")
        if actor == "user" and not cited <= allowed_user:
            checks.append("LỘ trích dẫn ngoài quyền")
        passed = not checks
        results.append({"actor": actor, "question": q, "flag": flag, "passed": passed, "issues": checks, "seconds": round(dt, 2), "citations": len(cites), "answer": d.get("answer"), "model": d.get("model"), "quotes": [c.get("quote") for c in cites]})
        print(f"{'ĐẠT ' if passed else 'TRƯỢT'} {dt:5.2f}s [{actor}{'/' + flag if flag else ''}] {q} → {(d.get('answer') or '')[:110]} {checks if checks else ''}")

    # Notebook của người dùng thử không được liệt kê nguồn ngoài quyền.
    src = who["user"].get(API + "/workflow/knowledge/sources", params={"workspaceId": WS}).json()
    src = src.get("data", src)
    leaked = [s for s in (src if isinstance(src, list) else []) if s.get("meetingId") not in allowed_user]
    print("Notebook người dùng thử:", len(src) if isinstance(src, list) else src, "nguồn; ngoài quyền:", len(leaked))
    ok = sum(r["passed"] for r in results)
    print(f"\nTổng: {ok}/{len(results)} | rò rỉ notebook: {len(leaked)}")
    json.dump({"results": results, "notebook_user_sources": len(src) if isinstance(src, list) else None, "notebook_leaks": len(leaked)}, open("rag_eval2_result.json", "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
