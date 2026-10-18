# DROP/GET

A self-hostable TikTok / YouTube / Instagram media downloader with a Reddit-informed digital-brutalist web UI, queueing, MP4, MP3, and photo/ZIP export. Deployable on Render. It has no login and removes temporary files after 20 minutes on subsequent requests. Works with **accessible content you own or have permission to save**, subject to source restrictions.

## Run

Docker:

```bash
docker build -t dropget .
docker run --rm -p 8000:8000 dropget
```

Python (requires FFmpeg on your system):

```bash
python -m pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8000
```

Open `http://localhost:8000`.

## Formats

| Source | MP4 | MP3 | Photos |
|---|---|---|---|
| TikTok | yt-dlp | yt-dlp + FFmpeg | embedded public slideshow metadata, then gallery-dl |
| YouTube | yt-dlp with Node 22 + EJS | yt-dlp with Node 22 + EJS, FFmpeg | no general photo gallery support |
| Instagram | yt-dlp with gallery-dl fallback | yt-dlp; gallery-dl + FFmpeg fallback | gallery-dl (public posts, if permitted by Instagram) |

No private-account bypass, cookie import, or watermark removal. Some content requires login or can stop working when the platforms change. Maximum output 200 MB; max 30 gallery items and 6 requests/IP/hour by default; up to two processing workers.

## Advertising

The interface includes a labelled **advertisement placement** but serves no live advertisements until an account is approved. For Google AdSense, set both variables:

```bash
ADSENSE_CLIENT=ca-pub-1234567890123456
ADSENSE_SLOT=1234567890
```

Replace with actual approved IDs. **AdSense approval is not guaranteed**; downloader niches have reported rejections. Never claim income or active advertising without credentials and approval.

## Deployment limits

GitHub Pages can host the **front-end preview only**. This application requires Python, gallery-dl, yt-dlp and FFmpeg on a live server to perform downloads. A GitHub Pages link without backend is not a working downloader. A free-tier host may restrict FFmpeg, bandwidth or disk usage.

## Design / technical research — Reddit only

- [r/webdev: digital brutalism is hard borders, black on white](https://www.reddit.com/r/webdev/comments/12xotlq/)
- [r/Design: dislike of generic purple-blue gradients](https://www.reddit.com/r/Design/comments/1k97b5a/)
- [r/InternetIsBeautiful: immediate, clean downloader UX](https://www.reddit.com/r/InternetIsBeautiful/comments/yzyeor/)
- [r/selfhosted: yt-dlp web interface architecture](https://www.reddit.com/r/selfhosted/comments/1bo4efv/)
- [r/ffmpeg: gallery-dl recommended for Instagram images](https://www.reddit.com/r/ffmpeg/comments/1ij8s2x/)
- [r/DataHoarder: TikTok slideshows with yt-dlp/gallery-dl](https://www.reddit.com/r/DataHoarder/comments/1i3oacl/)
- [r/Adsense: AdSense rejection risk](https://www.reddit.com/r/Adsense/comments/1r9lg24/)

This UI is a fresh implementation of the design pattern discussed on Reddit; it does not copy source code or artwork from Reddit contributors.


## Deployment and live checks

The repository contains `render.yaml` and `dropget/Dockerfile`. The deployed endpoint is https://dropget.onrender.com and `/api/health` reports `revision` and Node support for identifying when a new deployment is live.

GitHub Actions performs syntax/unit tests, Docker build verification, and live media download checks. See `unit-test-output.txt`, `container-build-result.txt` and `live-test-report.json` for recorded results; a passing health check **does not prove** any individual platform supports anonymous downloading.

YouTube and Instagram sometimes block cloud data-center IPs or demand account sessions even for otherwise publicly viewable posts. The service never asks for passwords, never accepts uploaded login cookies, and returns an actionable error instead of claiming success. Node/EJS helps with JavaScript challenges, but **cannot guarantee overcoming an IP-based access restriction**. TikTok slideshow HTML may be inaccessible from cloud infrastructure; the parser falls back to gallery-dl when no public slideshow metadata is present.

## Reddit-only research notes (October 2026)

- [Cloud-hosted YouTube bot restrictions](https://www.reddit.com/r/youtubedl/comments/1wnx365/)
- [Nightly yt-dlp and JavaScript runtimes](https://www.reddit.com/r/youtubedl/comments/1x84whl/)
- [Deno/JS requirements for yt-dlp](https://www.reddit.com/r/youtubedl/comments/1rusncq/)
- [Gallery-dl as Instagram fallback](https://www.reddit.com/r/youtubedl/comments/1q3qw6t/)
- [TikTok slideshow extraction from page metadata](https://www.reddit.com/r/DataHoarder/comments/1i3oacl/)
- [Instagram login restrictions](https://www.reddit.com/r/youtubedl/comments/1uk2fcz/)

