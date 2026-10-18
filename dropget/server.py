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
from urllib.request import Request as URLRequest, urlopen
from urllib.error import URLError
import json
import html

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


def files_in(folder):
    return sorted((p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in {
        ".mp4", ".m4v", ".mov", ".webm", ".mkv", ".mp3", ".m4a",
        ".jpg", ".jpeg", ".png", ".webp", ".avif"}), key=lambda p: p.name)


def gallery_command(folder, url):
    return [sys.executable, "-m", "gallery_dl", "--directory", str(folder),
            "--range", "1-30", url]


def video_command(folder, url, mode):
    cmd = [sys.executable, "-m", "yt_dlp", "--ignore-config", "--no-playlist",
           "--no-progress", "--no-warnings", "--restrict-filenames",
           "--max-filesize", "200M", "--socket-timeout", "15", "--retries", "2",
           "--fragment-retries", "2", "--no-mtime", "--paths", str(folder),
           "-o", "%(title).70B-%(id)s.%(ext)s"]
    host = (urlsplit(url).hostname or "").lower()
    if host == "youtube.com" or host.endswith(".youtube.com") or host == "youtu.be":
        if shutil.which("node"):
            cmd += ["--js-runtimes", "node", "--remote-components", "ejs:npm"]
    if mode == "audio":
        cmd += ["-f", "bestaudio/best", "-x", "--audio-format", "mp3"]
    else:
        cmd += ["-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
                "--merge-output-format", "mp4"]
    return cmd + [url]


def execute(cmd):
    return subprocess.run(cmd, cwd=str(ROOT), text=True, capture_output=True,
                          timeout=185, check=False)


def photo_sources(url):
    response = urlopen(URLRequest(url, headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml"}), timeout=18)
    with response:
        page = response.read(4_000_001)
    if len(page) > 4_000_000:
        raise ValueError("Страница слишком большая.")
    page = page.decode("utf-8", "replace")
    scripts = re.findall(r'<script[^>]+id=["\x27](?:__UNIVERSAL_DATA_FOR_REHYDRATION__|SIGI_STATE)["\x27][^>]*>(.*?)</script>', page, re.S)
    for raw in scripts:
        try:
            tree = json.loads(html.unescape(raw))
        except ValueError:
            continue
        stack = [tree]
        while stack:
            node = stack.pop()
            if isinstance(node, list):
                stack.extend(node[:100])
            if not isinstance(node, dict):
                continue
            post = node.get("imagePost")
            if isinstance(post, dict) and isinstance(post.get("images"), list):
                result = []
                for img in post["images"][:30]:
                    if not isinstance(img, dict):
                        continue
                    sources = img.get("imageURL") or img.get("displayImage") or {}
                    if isinstance(sources, dict):
                        urls = sources.get("urlList") or []
                        if isinstance(urls, list):
                            result.append([u for u in urls if isinstance(u, str)][:4])
                if result:
                    return result
            stack.extend(v for v in node.values() if isinstance(v, (dict, list)))
    return []


def trusted_image(url):
    try:
        part = urlsplit(url)
        host = (part.hostname or "").lower().rstrip(".")
        suffixes = (".tiktokcdn.com", ".tiktokcdn-us.com", ".byteimg.com",
                    ".muscdn.com", ".tiktokv.com")
        return part.scheme == "https" and not part.username and not part.password and not part.port and (
            host in {s[1:] for s in suffixes} or host.endswith(suffixes))
    except (ValueError, TypeError):
        return False


def tiktok_photos(folder, url):
    try:
        images = photo_sources(url)
    except (ValueError, URLError, TimeoutError, OSError):
        return False
    if not images:
        return False
    for i, urls in enumerate(images, 1):
        saved = False
        for src in urls:
            if not trusted_image(src):
                continue
            try:
                with urlopen(URLRequest(src, headers={"User-Agent": "Mozilla/5.0",
                        "Referer": "https://www.tiktok.com/"}), timeout=20) as response:
                    if not trusted_image(response.url):
                        continue
                    data = response.read(8_000_001)
                    kind = response.headers.get("Content-Type", "").lower()
                if len(data) > 8_000_000 or not kind.startswith("image/"):
                    continue
                extension = ".png" if "png" in kind else ".webp" if "webp" in kind else ".jpg"
                (folder / f"slide-{i:02d}{extension}").write_bytes(data)
                saved = True
                break
            except (URLError, TimeoutError, OSError, ValueError):
                pass
        if not saved:
            return False
    return True


def convert_gallery(folder, mode):
    files = files_in(folder)
    if mode == "photos":
        return [p for p in files if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".avif"}]
    videos = [p for p in files if p.suffix.lower() in {".mp4", ".m4v", ".mov", ".webm", ".mkv"}]
    if not videos:
        return []
    source = videos[0]
    target = folder / ("result.mp3" if mode == "audio" else "result.mp4")
    if mode == "audio":
        cmd = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
               "-i", str(source), "-vn", "-b:a", "192k", str(target)]
    elif source.suffix.lower() == ".mp4":
        return [source]
    else:
        cmd = ["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
               "-i", str(source), "-map", "0:v:0", "-map", "0:a?",
               "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", str(target)]
    output = subprocess.run(cmd, capture_output=True, timeout=115)
    return [target] if output.returncode == 0 and target.is_file() else []


def friendly_error(platform, details):
    msg = details.lower()
    if any(v in msg for v in ["sign in to confirm", "not a bot", "login page", "log in", "cookies", "authentication", "empty media response"]):
        return f"{platform} ограничил доступ без входа или проверяет облачный сервер. Этот пост нельзя скачать отсюда без авторизации; логины и cookies мы не собираем."
    if "404" in msg or "not found" in msg:
        return "Публикация удалена, недоступна или ссылка устарела."
    if "429" in msg or "rate limit" in msg:
        return "Источник временно ограничил частоту запросов. Повторите позже."
    return f"Не удалось получить медиа из {platform}. Проверьте доступность публичной ссылки."


def run_job(job_id, url, mode):
    with LOCK:
        job = JOBS[job_id]
        job["state"] = "working"
    folder = job["folder"]
    platform = job["platform"]
    errors = []
    output_files = []
    try:
        if mode == "photos":
            if platform == "TikTok":
                direct = folder / "direct"
                direct.mkdir()
                if tiktok_photos(direct, url):
                    output_files = files_in(direct)
            if not output_files:
                target = folder / "gallery"
                target.mkdir()
                result = execute(gallery_command(target, url))
                output_files = convert_gallery(target, mode)
                if not output_files:
                    errors.append(result.stderr or result.stdout or "No images found")
        else:
            target = folder / "primary"
            target.mkdir()
            result = execute(video_command(target, url, mode))
            if result.returncode == 0:
                output_files = [p for p in files_in(target)
                                if p.suffix.lower() == (".mp3" if mode == "audio" else ".mp4")]
            if not output_files:
                errors.append(result.stderr or result.stdout or "No media")
                if platform == "Instagram":
                    target = folder / "gallery"
                    target.mkdir()
                    result = execute(gallery_command(target, url))
                    output_files = convert_gallery(target, mode)
                    if not output_files:
                        errors.append(result.stderr or result.stdout or "No media")
        if not output_files:
            raise ValueError(friendly_error(platform, " ".join(errors)))
        total = sum(p.stat().st_size for p in output_files)
        if total > MAX_BYTES:
            raise ValueError("Общий размер превышает 200 МБ.")
        if len(output_files) > 1:
            bundle = folder / "download.zip"
            with zipfile.ZipFile(bundle, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=4) as archive:
                for index, path in enumerate(output_files, 1):
                    archive.write(path, f"{index:02d}-{path.name}")
            output = bundle
        else:
            output = output_files[0]
        with LOCK:
            job.update(state="ready", filename=output.name, file=str(output), size=output.stat().st_size)
    except subprocess.TimeoutExpired:
        with LOCK:
            job.update(state="error", error="Превышено время ожидания источника.")
    except Exception as exc:
        with LOCK:
            job.update(state="error", error=str(exc)[:350])


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

