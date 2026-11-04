"""Kiểm thử đầu-cuối qua hệ thống thật: tạo cuộc họp → tải audio → Whisper + tách
người nói (ai-worker) → LLM → biên bản nháp + hàng đợi duyệt. Đo thời gian từng chặng.

  python e2e_audio.py data/overlap.wav "Tiêu đề"
"""

import json
import os
import sys
import time

import requests

API = "http://localhost:3010"
s = requests.Session()


def call(method, path, **kw):
    r = s.request(method, API + path, timeout=120, **kw)
    if r.status_code >= 400:
        sys.exit(f"{method} {path} → {r.status_code} {r.text[:400]}")
    body = r.json()
    return body.get("data", body) if isinstance(body, dict) else body


wav, title = sys.argv[1], sys.argv[2]
tok = call("POST", "/auth/login", json={"username": "admin", "password": "admin", "platform": "Web"})["accessToken"]
s.headers["Authorization"] = f"Bearer {tok}"
ws = call("GET", "/me/workspaces")
ws = (ws if isinstance(ws, list) else ws.get("items") or ws.get("data"))[0]
ws_id = ws.get("_id") or ws.get("id")

meeting = call("POST", "/workflow/meetings", json={"workspaceId": ws_id, "title": title, "sourceType": "in_person", "description": "Kiểm thử đầu-cuối: ghi âm cuộc họp trực tiếp 4 người"})
meeting_id = meeting.get("_id") or meeting.get("id") or meeting.get("meeting", {}).get("_id")
print("meeting", meeting_id)

t0 = time.time()
with open(wav, "rb") as fh:
    up = call(
        "POST",
        "/media-file/upload",
        headers={"x-workspace-id": ws_id, "x-meeting-id": meeting_id},
        files={"file": (os.path.basename(wav), fh, "audio/wav")},
        data={"workspaceId": ws_id, "meetingId": meeting_id},
    )
print("upload", json.dumps(up, ensure_ascii=False)[:300])
file_id = up.get("_id") or up.get("fileId") or (up.get("file") or {}).get("_id")
bucket = up.get("bucket") or (up.get("file") or {}).get("bucket")
key = up.get("objectKey") or (up.get("file") or {}).get("objectKey")
job = call("POST", "/meeting-processing/transcribe", headers={"x-workspace-id": ws_id, "x-meeting-id": meeting_id}, json={"workspaceId": ws_id, "meetingId": meeting_id, "bucket": bucket, "objectKey": key, "fileId": file_id})
print("transcribe job", (job or {}).get("_id"))
t_up = time.time()

seen = None
while time.time() - t0 < 1500:
    lst = call("GET", "/me/meetings", headers={"x-workspace-id": ws_id}, params={"workspaceId": ws_id})
    rows = lst if isinstance(lst, list) else lst.get("items") or lst.get("data") or []
    m = next((x for x in rows if (x.get("_id") or x.get("id")) == meeting_id), {})
    status = f"{m.get('status')}/{m.get('processingStatus')}"
    if status != seen:
        print(f"{time.time() - t0:6.1f}s  processingStatus={status}", flush=True)
        seen = status
    if status.endswith(("/done", "/failed")):
        break
    time.sleep(3)
print(json.dumps({"meetingId": meeting_id, "workspaceId": ws_id, "total_s": round(time.time() - t0, 1), "status": seen}))
