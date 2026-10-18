import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

BASE = "https://dropget.onrender.com"
CASES = [
    ("tiktok_video", "video", "https://www.tiktok.com/@s_arira_s/video/7509275887561346350"),
    ("tiktok_audio", "audio", "https://www.tiktok.com/@s_arira_s/video/7509275887561346350"),
    ("tiktok_photos", "photos", "https://www.tiktok.com/@imluca66/photo/7617926459105070358"),
    ("youtube_video", "video", "https://www.youtube.com/shorts/hDs3lKzpTto"),
    ("instagram_video", "video", "https://www.instagram.com/reel/DZzPabEJ8Pf/"),
    ("instagram_photos", "photos", "https://www.instagram.com/p/DV_k-0SiCdr/"),
]

def call(path, data=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(data).encode() if data else None, headers={"Content-Type": "application/json", "User-Agent": "Dropget-E2E/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=85) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}: {exc.read(500).decode('utf-8', 'replace')}")

def verify_file(job_id, mode):
    req = urllib.request.Request(BASE + "/api/files/" + job_id, headers={"Range": "bytes=0-255", "User-Agent": "Dropget-E2E/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            blob = resp.read(256)
            if resp.status not in (200, 206):
                raise RuntimeError("Unexpected file HTTP status " + str(resp.status))
            if mode == "video":
                valid = blob[4:8] == b"ftyp"
            elif mode == "audio":
                valid = blob.startswith(b"ID3") or blob[:1] == bytes([255])
            else:
                valid = blob.startswith((bytes([80,75,3,4]), bytes([255,216,255]), bytes([137,80,78,71]), b"RIFF"))
            if not valid:
                raise RuntimeError(f"Unexpected {mode} file signature: {blob[:12].hex()}")
            return {"download_status": resp.status, "signature_valid": True}
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Download HTTP {exc.code}: {exc.read(350).decode('utf-8','replace')}")

from pathlib import Path
report_file = Path("dropget/live-test-report.json")
report = {"site": BASE, "checked_at": datetime.now(timezone.utc).isoformat(), "cases": {}}
ready = False
for attempt in range(13):
    try:
        h = call("/api/health")
        if h.get("revision") == "r2-20261018":
            report["health"] = h
            ready = True
            break
    except Exception as exc:
        report["health_error"] = str(exc)
    time.sleep(10)
if not ready:
    report["deploy_error"] = "Live server did not expose revision r2-20261018 before test timeout"
    report_file.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(report), flush=True)
    raise SystemExit(1)
for name, mode, url in CASES:
    entry = {"mode": mode, "test_url": url, "result": "failed"}
    start = time.monotonic()
    try:
        job = call("/api/jobs", {"url": url, "mode": mode})
        entry["id"] = job["id"]
        while time.monotonic() - start < 235:
            state = call("/api/jobs/" + job["id"])
            if state["state"] == "ready":
                entry.update({"filename": state["filename"], "size": state["size"]})
                entry.update(verify_file(job["id"], mode))
                entry["result"] = "passed"
                break
            if state["state"] == "error":
                entry["error"] = state.get("error", "")
                break
            time.sleep(5)
        else:
            entry["error"] = "Timed out waiting for media after 235 seconds"
    except Exception as exc:
        entry["error"] = str(exc)[:500]
    entry["elapsed_seconds"] = round(time.monotonic() - start, 1)
    report["cases"][name] = entry
    print(name + ": " + json.dumps(entry, ensure_ascii=False), flush=True)
from pathlib import Path
Path("dropget/live-test-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
print("RESULT_REPORT=" + json.dumps(report, ensure_ascii=False), flush=True)
