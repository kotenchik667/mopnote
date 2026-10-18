from fastapi.testclient import TestClient
from fastapi import HTTPException
import server

client = TestClient(server.app)


def test_valid_links():
    for url in ["https://www.youtube.com/watch?v=123", "https://vm.tiktok.com/ABC", "https://www.instagram.com/reel/C123/"]:
        assert server.validate_url(url)[1] in ("YouTube", "TikTok", "Instagram")


def test_no_ssrf():
    for url in ["http://youtube.com/watch?v=1", "https://youtube.com.bad.com/watch", "https://127.0.0.1:8000/file", "https://evil.com/tiktok", "https://x:y@tiktok.com/video", "https://tiktok.com:444/video"]:
        try:
            server.validate_url(url)
            assert False, url
        except HTTPException as exc:
            assert exc.status_code == 400


def test_health_and_ui():
    assert client.get("/").status_code == 200
    assert "DROP/GET" in client.get("/").text
    assert client.get("/api/health").json()["ok"]
    assert client.get("/static/site.css").status_code == 200


def test_invalid_jobs():
    assert client.post("/api/jobs", json={"url": "https://bad.example/a", "mode": "video"}).status_code in (400, 503)
    assert client.post("/api/jobs", json={"url": "https://www.youtube.com/watch?v=a", "mode": "books"}).status_code == 400
    assert client.get("/api/jobs/deadbeef").status_code == 404
    assert client.get("/api/files/deadbeef").status_code == 404


def test_tiktok_album_parser(monkeypatch):
    from io import BytesIO
    import json
    html = '<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">' + json.dumps({
        "__DEFAULT_SCOPE__": {"webapp.video-detail": {"itemInfo": {"itemStruct": {
            "imagePost": {"images": [{"imageURL": {"urlList": [
                "https://p16-sign.tiktokcdn.com/test.jpeg"
            ]}}]}
        }}}}
    }) + "</script>"
    class Response:
        def __init__(self, data, content_type="text/html"):
            self.data = BytesIO(data)
            self.headers = {"Content-Type": content_type}
            self.url = "https://p16-sign.tiktokcdn.com/img.jpg"
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def read(self, n):
            return self.data.read(n)
    def opener(request, timeout=0):
        if request.full_url.startswith("https://www.tiktok.com"):
            return Response(html.encode())
        return Response(b"\\xff\\xd8\\xffjpeg", "image/jpeg")
    monkeypatch.setattr(server, "urlopen", opener)
    assert server.photo_sources("https://www.tiktok.com/@test/photo/123") == [
        ["https://p16-sign.tiktokcdn.com/test.jpeg"]
    ]


def test_gallery_uses_only_media(tmp_path):
    (tmp_path / "image.jpg").write_bytes(b"jpg")
    (tmp_path / "log.txt").write_text("ignore")
    (tmp_path / "a.mp4").write_bytes(b"mp4")
    files = server.files_in(tmp_path)
    assert [x.name for x in files] == ["a.mp4", "image.jpg"]
    assert server.convert_gallery(tmp_path, "photos")[0].name == "image.jpg"


def test_tiktok_url_trust():
    assert server.trusted_image("https://p16-sign.tiktokcdn.com/a.jpg")
    assert not server.trusted_image("http://p16-sign.tiktokcdn.com/a.jpg")
    assert not server.trusted_image("https://tiktokcdn.com.evil.test/file.jpg")
    assert not server.trusted_image("https://127.0.0.1/test.jpg")


def test_commands_include_node_for_youtube(monkeypatch, tmp_path):
    monkeypatch.setattr(server.shutil, "which", lambda executable: "/usr/bin/node")
    command = server.video_command(tmp_path, "https://www.youtube.com/watch?v=test", "video")
    assert "--js-runtimes" in command
    assert "ejs:npm" in command
    command = server.video_command(tmp_path, "https://www.tiktok.com/@x/video/123", "audio")
    assert "--js-runtimes" not in command
    assert "--audio-format" in command

def test_instaloader_only_for_public_post_patterns(tmp_path):
    assert server.instaloader_command(tmp_path, "https://www.instagram.com/p/ABC123/")[-1] == "-ABC123"
    assert server.instaloader_command(tmp_path, "https://www.instagram.com/reel/ABC123/")[-1] == "-ABC123"
    assert server.instaloader_command(tmp_path, "https://www.instagram.com/private/abc/") is None
