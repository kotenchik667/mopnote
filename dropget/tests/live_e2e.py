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
                valid = blob.startswith(b"ID3") or blob[:1] == b"\\xff"
            else:
                valid = blob.startswith((b"PK\\x03\\x04", b"\\xff\\xd8\\xff", b"\\x89PNG", b"RIFF"))
            if not valid:
                raise RuntimeError(f"Unexpected {mode} file signature: {blob[:12].hex()}")
            return {"download_status": resp.status, "signature_valid": True}
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Download HTTP {exc.code}: {exc.read(350).decode('utf-8','replace')}")

report = {"checked_at": datetime.now(timezone.utc).isoformat(), "site": BASE, "cases": {}}
try:
    report["health"] = call("/api/health")
except Exception as exc:
    report["health_error"] = str(exc)
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
