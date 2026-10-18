import os
import re
import sys
import time
import uuid
import shutil
import zipfile
import tempfile
import threading
import subprocess
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).parent
TEMP = Path(tempfile.mkdtemp(prefix="dropget-"))
TTL = 20 * 60
MAX_BYTES = 200 * 1024 * 1024
MAX_REQUESTS = int(os.getenv("MAX_REQUESTS_PER_HOUR", "6"))
ALLOWED = {
    "youtube.com": "YouTube",
    "youtu.be": "YouTube",
    "tiktok.com": "TikTok",
    "instagram.com": "Instagram",
    "instagr.am": "Instagram",
}
MODES = {"video", "audio", "photos"}
LOCK = threading.Lock()
JOBS = {}
REQUESTS = defaultdict(deque)
EXECUTOR = ThreadPoolExecutor(max_workers=2)

app = FastAPI(title="DROP/GET", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


class JobRequest(BaseModel):
    url: str = Field(min_length=10, max_length=1600)
    mode: str


def validate_url(value):
    try:
        p = urlsplit(value.strip())
        host = (p.hostname or "").lower().rstrip(".")
        if p.scheme != "https" or p.username or p.password or p.port or not p.path:
            raise ValueError()
        matches = [name for name in ALLOWED if host == name or host.endswith("." + name)]
        if not matches:
            raise ValueError()
        return value.strip(), ALLOWED[max(matches, key=len)]
    except (ValueError, TypeError):
        raise HTTPException(400, "Нужна HTTPS-ссылка TikTok, YouTube или Instagram.")


def cleanup():
    now = time.monotonic()
    with LOCK:
        outdated = [key for key, job in JOBS.items() if now - job["created"] > TTL and job["state"] != "working"]
        paths = [JOBS.pop(key)["folder"] for key in outdated]
    for folder in paths:
        shutil.rmtree(folder, ignore_errors=True)


def sweep():
    while True:
        time.sleep(60)
        cleanup()


threading.Thread(target=sweep, daemon=True).start()


def engine_ready(mode):
    modules = ("gallery_dl",) if mode == "photos" else ("yt_dlp",)
    for name in modules:
        try:
            __import__(name)
        except ImportError:
            return False
    return mode == "photos" or shutil.which("ffmpeg") is not None


def run_job(job_id, url, mode):
    with LOCK:
        job = JOBS[job_id]
        job["state"] = "working"
    folder = job["folder"]
    try:
        if mode == "photos":
            cmd = [sys.executable, "-m", "gallery_dl", "--directory", str(folder),
                   "--range", "1-30", url]
        else:
            cmd = [sys.executable, "-m", "yt_dlp", "--ignore-config", "--no-playlist",
                   "--no-progress", "--no-warnings", "--restrict-filenames",
                   "--max-filesize", "200M", "--socket-timeout", "15", "--retries", "2",
                   "--fragment-retries", "2", "--no-mtime", "--paths", str(folder),
                   "-o", "%(title).70B-%(id)s.%(ext)s"]
            if mode == "audio":
                cmd += ["-f", "bestaudio/best", "-x", "--audio-format", "mp3"]
            else:
                cmd += ["-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b", "--merge-output-format", "mp4"]
            cmd.append(url)
        result = subprocess.run(cmd, cwd=str(ROOT), text=True, capture_output=True, timeout=210, check=False)
        if result.returncode:
            raise ValueError((result.stderr or result.stdout)[-350:] or "Источник отклонил запрос.")
        files = sorted((p for p in folder.rglob("*") if p.is_file()), key=lambda p: p.name)
        total = sum(p.stat().st_size for p in files)
        if not files:
            raise ValueError("Медиа не найдено. Возможно, источник требует вход или ограничивает доступ.")
        if total > MAX_BYTES:
            raise ValueError("Файл превышает лимит 200 МБ.")
        if len(files) > 1:
            bundle = folder / "download.zip"
            with zipfile.ZipFile(bundle, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=4) as archive:
                for index, file in enumerate(files, 1):
                    archive.write(file, f"{index:02d}-{file.name}")
            output = bundle
        else:
            output = files[0]
        with LOCK:
            job.update(state="ready", filename=output.name, file=str(output), size=output.stat().st_size)
    except subprocess.TimeoutExpired:
        with LOCK:
            job.update(state="error", error="Превышено время ожидания источника.")
    except Exception as exc:
        with LOCK:
            job.update(state="error", error=str(exc)[-350:])


@app.get("/", response_class=HTMLResponse)
def home():
    return (ROOT / "static" / "index.html").read_text(encoding="utf-8")


@app.get("/api/health")
def health():
    return {"ok": True, "video": engine_ready("video"),
            "audio": engine_ready("audio"), "photos": engine_ready("photos")}


@app.get("/api/ads")
def ads():
    client = os.getenv("ADSENSE_CLIENT", "")
    slot = os.getenv("ADSENSE_SLOT", "")
    return {"client": client if re.fullmatch(r"ca-pub-\d{16}", client) else "",
            "slot": slot if re.fullmatch(r"\d{10}", slot) else ""}


@app.post("/api/jobs", status_code=202)
def submit(body: JobRequest, request: Request):
    cleanup()
    if body.mode not in MODES:
        raise HTTPException(400, "Выберите видео, MP3 или фото.")
    url, platform = validate_url(body.url)
    if not engine_ready(body.mode):
        raise HTTPException(503, "Движок не установлен. Установите зависимости и FFmpeg.")
    ip = request.client.host if request.client else "local"
    now = time.monotonic()
    with LOCK:
        q = REQUESTS[ip]
        while q and q[0] < now - 3600:
            q.popleft()
        if len(q) >= MAX_REQUESTS:
            raise HTTPException(429, "Лимит запросов. Попробуйте через час.")
        q.append(now)
        job_id = uuid.uuid4().hex
        folder = TEMP / job_id
        folder.mkdir()
        JOBS[job_id] = {"created": now, "state": "queued", "platform": platform,
                        "mode": body.mode, "folder": folder, "error": "", "filename": "", "size": 0}
    EXECUTOR.submit(run_job, job_id, url, body.mode)
    return {"id": job_id, "platform": platform}


@app.get("/api/jobs/{job_id}")
def status(job_id: str):
    cleanup()
    with LOCK:
        job = JOBS.get(job_id)
        if not job:
            raise HTTPException(404, "Загрузка истекла или не найдена.")
        return {key: job[key] for key in ("state", "platform", "mode", "error", "filename", "size")}


@app.get("/api/files/{job_id}")
def download(job_id: str):
    with LOCK:
        job = JOBS.get(job_id)
        if not job or job["state"] != "ready":
            raise HTTPException(404, "Файл ещё не готов или уже удалён.")
        file = job["file"]
    return FileResponse(file, filename=Path(file).name, media_type="application/octet-stream")

