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

