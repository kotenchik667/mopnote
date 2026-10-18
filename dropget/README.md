# DROP/GET

A self-hostable TikTok / YouTube / Instagram media downloader with a digital-brutalist web UI, queueing, MP4, MP3, and photo/ZIP export. It has no login and removes temporary files after 20 minutes on subsequent requests. Works with **accessible content you own or have permission to save**, subject to source restrictions.

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
| TikTok | yt-dlp | yt-dlp + FFmpeg | gallery-dl, slideshow output where supported |
| YouTube | yt-dlp | yt-dlp + FFmpeg | only if gallery-dl can extract media |
| Instagram | yt-dlp, accessible posts | yt-dlp + FFmpeg | gallery-dl, accessible posts |

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

