"""Dựng dữ liệu cho bộ chấm hỏi đáp mở rộng (máy local, tài khoản thử).

- Dự án "Marketing Tết 2027" + cuộc họp kế hoạch chiến dịch (có đáp án).
- Dự án "Ban giám đốc" + cuộc họp lương thưởng (nội dung nhạy cảm).
- Người dùng thử chỉ là thành viên dự án Marketing: không được thấy cuộc họp
  ban giám đốc lẫn cuộc họp sprint 12 (của admin, không thuộc dự án nào).
Ghi kết quả vào rag_seed.json (id cuộc họp, tài khoản thử) cho rag_eval2.py.
"""

import json
import secrets
import sys
import time

import requests

API = "http://localhost:3010"

MARKETING = [
    ("Mai", "Chào cả nhóm, hôm nay mình chốt kế hoạch chiến dịch marketing Tết 2027 cho ứng dụng đặt lịch phòng khám."),
    ("Mai", "Ngân sách tổng cho chiến dịch là 150 triệu đồng, ban giám đốc đã duyệt con số này."),
    ("Quân", "Em đề xuất chạy cả Google Ads cho chắc."),
    ("Mai", "Google Ads năm ngoái hiệu quả thấp. Chốt kênh chính là TikTok và Facebook, không chạy Google Ads nữa."),
    ("Quân", "Vâng, vậy em lo quảng cáo TikTok, bắt đầu chạy từ ngày 1 tháng 1 năm 2027."),
    ("Linh", "Phần nội dung em sẽ viết 12 bài đăng cho Facebook và TikTok, hạn nộp bản nháp là ngày 20 tháng 12."),
    ("Tuấn", "Bộ nhận diện hình ảnh Tết em định xong ngày 10 tháng 12."),
    ("Mai", "10 tháng 12 hơi gấp vì Tuấn đang làm dự án khác. Thôi lùi về ngày 15 tháng 12 nhé."),
    ("Tuấn", "Dạ, em chốt bộ nhận diện xong ngày 15 tháng 12."),
    ("Linh", "Hay là mình mời một KOL mảng sức khoẻ quay video giới thiệu?"),
    ("Mai", "Ý hay nhưng chưa chốt được, phải chờ báo giá của hai bên KOL đã. Quân lấy báo giá giúp chị trước thứ Sáu."),
    ("Quân", "Vâng, em lấy báo giá KOL và gửi chị trước thứ Sáu."),
    ("Tuấn", "Trưa nay cả nhóm đi ăn lẩu không?"),
    ("Linh", "Đi chứ, quán lẩu nấm gần công ty nhé."),
    ("Mai", "Quay lại việc. Chỉ số mục tiêu là 3.000 lượt đặt lịch mới trong tháng Tết."),
    ("Mai", "Cuộc họp tiếp theo vào thứ Năm tuần sau lúc 14 giờ để duyệt bản nháp nội dung."),
]

BOARD = [
    ("Hải", "Cuộc họp ban giám đốc về lương thưởng cuối năm, nội dung này chỉ ban giám đốc được biết."),
    ("Hương", "Quỹ thưởng Tết năm nay kế toán đề xuất là 800 triệu đồng."),
    ("Hải", "Đồng ý. Chốt thưởng Tết bằng 2 tháng lương cho nhân viên chính thức."),
    ("Hương", "Còn tăng lương thì sao anh?"),
    ("Hải", "Tăng lương 8 phần trăm cho toàn bộ nhân viên, áp dụng từ tháng 3 năm 2027."),
    ("Hương", "Em sẽ lập bảng lương mới và gửi anh duyệt trước ngày 25 tháng 12."),
]


def call(s, method, path, ok=True, **kw):
    r = s.request(method, API + path, timeout=60, **kw)
    if ok and r.status_code >= 400:
        sys.exit(f"{method} {path} → {r.status_code} {r.text[:300]}")
    try:
        body = r.json()
    except ValueError:
        body = {}
    return r.status_code, (body.get("data", body) if isinstance(body, dict) else body)


def login(username, password):
    s = requests.Session()
    _, tok = call(s, "POST", "/auth/login", json={"username": username, "password": password, "platform": "Web"})
    s.headers["Authorization"] = "Bearer " + tok["accessToken"]
    return s


def meeting_with_transcript(admin, ws_id, project_id, title, lines):
    _, m = call(admin, "POST", "/workflow/meetings", json={"workspaceId": ws_id, "projectId": project_id, "title": title, "sourceType": "live_caption"})
    mid = m["_id"]
    segs = []
    t = 0
    for speaker, text in lines:
        dur = 2500 + 60 * len(text)
        segs.append({"speakerLabel": speaker, "displayName": speaker, "startMs": t, "endMs": t + dur, "text": text})
        t += dur + 600
    h = {"x-workspace-id": ws_id, "x-meeting-id": mid}
    call(admin, "POST", "/meeting-processing/live-transcript", headers=h, json={"workspaceId": ws_id, "meetingId": mid, "segments": segs})
    call(admin, "POST", "/meeting-processing/live-transcript/finalize", headers=h, json={"workspaceId": ws_id, "meetingId": mid})
    return mid


def main():
    admin = login("admin", "admin")
    _, wss = call(admin, "GET", "/me/workspaces")
    ws = (wss if isinstance(wss, list) else wss.get("items"))[0]
    ws_id = ws.get("_id") or ws.get("id")
    H = {"x-workspace-id": ws_id}
    _, me = call(admin, "GET", "/user/me")
    admin_id = me.get("_id")

    _, mk = call(admin, "POST", "/project", headers=H, json={"workspaceId": ws_id, "name": "Marketing Tết 2027", "status": "active", "createdById": admin_id})
    _, bgd = call(admin, "POST", "/project", headers=H, json={"workspaceId": ws_id, "name": "Ban giám đốc", "status": "active", "createdById": admin_id})
    m_mk = meeting_with_transcript(admin, ws_id, mk["_id"], "Họp kế hoạch chiến dịch marketing Tết 2027", MARKETING)
    m_bgd = meeting_with_transcript(admin, ws_id, bgd["_id"], "Họp ban giám đốc – lương thưởng cuối năm", BOARD)

    # Người dùng thử: thành viên workspace, chỉ là MEMBER của dự án Marketing.
    name = "kiemthu_mkt_" + secrets.token_hex(2)
    pw = secrets.token_urlsafe(12)
    anon = requests.Session()
    call(anon, "POST", "/auth/register", json={"username": name, "password": pw, "email": f"{name}@example.test", "fullname": "Nhân viên Marketing (thử)"})
    call(admin, "POST", "/workflow/members/invite", headers=H, json={"workspaceId": ws_id, "identifier": name, "role": "MEMBER"})
    _, users = call(admin, "GET", "/user/many", ok=False, params={"condition": json.dumps({"username": name})})
    user_id = (users[0] if isinstance(users, list) and users else {}).get("_id")
    if user_id:
        call(admin, "POST", "/project-member", headers={**H, "x-project-id": mk["_id"]}, json={"workspaceId": ws_id, "projectId": mk["_id"], "userId": user_id, "role": "MEMBER"})

    out = {"workspaceId": ws_id, "projects": {"marketing": mk["_id"], "bgd": bgd["_id"]}, "meetings": {"marketing": m_mk, "bgd": m_bgd, "sprint": "6aeb6762d975938cdf96ae87"}, "user": {"username": name, "password": pw, "id": user_id}}
    json.dump(out, open("rag_seed.json", "w"), ensure_ascii=False, indent=1)
    print("đã dựng:", {k: v for k, v in out.items() if k != "user"}, "| người dùng thử:", name, "id có:", bool(user_id))
    time.sleep(15)
    user = login(name, pw)
    _, mine = call(user, "GET", "/me/meetings", headers=H, params={"workspaceId": ws_id})
    rows = mine if isinstance(mine, list) else mine.get("items") or []
    print("người dùng thử thấy:", [r.get("title") for r in rows])


if __name__ == "__main__":
    main()
