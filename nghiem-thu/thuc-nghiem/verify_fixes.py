"""Kiểm chứng các bản sửa: tệp trùng giữa hai cuộc họp, cờ nói chồng tắt, LLM luồng,
gán tên người nói → phân tích lại dùng tên thật, CRUD /note bị khoá với người thường."""

import json
import os
import secrets
import subprocess
import sys
import time

import requests

API = "http://localhost:3010"
s = requests.Session()
WAV = sys.argv[1]


def call(method, path, sess=s, ok=True, **kw):
    r = sess.request(method, API + path, timeout=120, **kw)
    if ok and r.status_code >= 400:
        sys.exit(f"{method} {path} → {r.status_code} {r.text[:300]}")
    try:
        body = r.json()
    except ValueError:
        body = {}
    return r.status_code, (body.get("data", body) if isinstance(body, dict) else body)


def psql(sql):
    out = subprocess.run(
        ["docker", "compose", "exec", "-T", "postgres", "sh", "-c", 'psql -U "$POSTGRES_USER" -d meetingmind -At -F " | "'],
        input=sql, capture_output=True, text=True, cwd="/home/dinh-tran/Documents/ki1nam4/laptrinhwebnangcao/meetingmind",
    )
    return out.stdout.strip()


_, login = call("POST", "/auth/login", json={"username": "admin", "password": "admin", "platform": "Web"})
s.headers["Authorization"] = f"Bearer {login['accessToken']}"
_, wss = call("GET", "/me/workspaces")
ws = (wss if isinstance(wss, list) else wss.get("items"))[0]
ws_id = ws.get("_id") or ws.get("id")
H = {"x-workspace-id": ws_id}


def wait_done(mid, timeout=900):
    t = time.time()
    while time.time() - t < timeout:
        _, lst = call("GET", "/me/meetings", headers=H, params={"workspaceId": ws_id})
        rows = lst if isinstance(lst, list) else lst.get("items") or []
        m = next((x for x in rows if (x.get("_id") or x.get("id")) == mid), {})
        if m.get("processingStatus") in ("done", "failed"):
            return m.get("processingStatus"), round(time.time() - t, 1)
        time.sleep(3)
    return "timeout", timeout


# 1) Tệp trùng nội dung cho cuộc họp mới phải có bản ghi riêng của cuộc họp đó.
_, meeting = call("POST", "/workflow/meetings", json={"workspaceId": ws_id, "title": "Kiểm chứng bản sửa – họp sprint 12", "sourceType": "in_person"})
mid = meeting.get("_id")
with open(WAV, "rb") as fh:
    _, up = call("POST", "/media-file/upload", headers={**H, "x-meeting-id": mid}, files={"file": (os.path.basename(WAV), fh, "audio/wav")}, data={"workspaceId": ws_id, "meetingId": mid})
print("1. tệp trùng: bản ghi thuộc cuộc họp mới =", up.get("meetingId") == mid, "| dùng chung object =", up.get("objectKey"))
call("POST", "/meeting-processing/transcribe", headers={**H, "x-meeting-id": mid}, json={"workspaceId": ws_id, "meetingId": mid, "bucket": up["bucket"], "objectKey": up["objectKey"], "fileId": up["_id"]})
status, secs = wait_done(mid)
print(f"   xử lý: {status} sau {secs}s")

# 2) Cờ nói chồng mặc định tắt.
print("2. đoạn bị gắn cờ nói chồng:", psql(f"select count(*) filter (where \"isOverlapping\"), count(*) from core.transcript_segments where \"meetingId\"='{mid}';"))

# 3) Gán tên: lấy hai thành viên workspace gán cho Người nói 1, 2 rồi phân tích lại.
users = psql(f"select u._id, coalesce(u.fullname, u.username) from core.workspace_members m join core.\"User\" u on u._id=m.\"userId\" where m.\"workspaceId\"='{ws_id}' limit 2;").splitlines()
for label, row in zip(["Người nói 1", "Người nói 2"], users):
    uid, name = [x.strip() for x in row.split("|")]
    call("POST", f"/workflow/meetings/{mid}/speakers", headers={**H, "x-meeting-id": mid}, json={"speakerLabel": label, "userId": uid})
    print(f"3. gán {label} → {name}")
print("   alias:", psql(f"select \"speakerLabel\" || '=' || \"displayName\" from core.speaker_aliases where \"meetingId\"='{mid}';").replace("\n", ", "))
call("POST", f"/workflow/meetings/{mid}/reanalyze", headers={**H, "x-meeting-id": mid})
time.sleep(3)
status, secs = wait_done(mid)
print(f"   phân tích lại: {status} sau {secs}s")
print("   số lô đề xuất:", psql(f"select count(*) from core.review_batches where \"meetingId\"='{mid}';"))
print("   người thực hiện ở lô mới nhất:", psql(
    f"select string_agg(distinct coalesce(ri.payload->>'assigneeHint','(trống)'), ', ') from core.review_items ri where ri.\"reviewBatchId\"=(select _id from core.review_batches where \"meetingId\"='{mid}' order by \"createdAt\" desc limit 1) and ri.type='action_item';"))

# 4) CRUD /note với tài khoản thường (tài khoản thử tạo trên máy local).
u = s.__class__()
name = "kiemthu_" + secrets.token_hex(3)
pw = secrets.token_urlsafe(12)
call("POST", "/auth/register", sess=u, json={"username": name, "password": pw, "email": f"{name}@example.test", "fullname": "Tài khoản kiểm thử"}, ok=False)
code, tok = call("POST", "/auth/login", sess=u, json={"username": name, "password": pw, "platform": "Web"}, ok=False)
if code < 400:
    u.headers["Authorization"] = f"Bearer {tok['accessToken']}"
    code, _ = call("GET", "/note/many", sess=u, ok=False)
    print("4. GET /note/many bằng tài khoản thường →", code)
    code, _ = call("GET", "/note/many", ok=False)
    print("   GET /note/many bằng SUPER_ADMIN →", code)
else:
    print("4. không đăng nhập được tài khoản thử:", code, tok)
print(json.dumps({"meetingId": mid}))
