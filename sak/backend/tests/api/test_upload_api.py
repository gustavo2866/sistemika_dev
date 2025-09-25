import io
from pathlib import Path

from fastapi.testclient import TestClient

SMALL_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00"
    b"\x90wS\xde\x00\x00\x00\x0bIDATx\x9cc``\x00\x00\x00\x02\x00\x01"
    b"\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_upload_and_retrieve_image(client: TestClient) -> None:
    files = {"file": ("tiny.png", io.BytesIO(SMALL_PNG), "image/png")}
    response = client.post("/api/upload", files=files)
    assert response.status_code == 200, response.text

    body = response.json()
    filename = body["filename"]

    image_path = Path("uploads") / "images" / filename
    assert image_path.exists()

    fetch = client.get(body["url"])
    assert fetch.status_code == 200

    image_path.unlink(missing_ok=True)
