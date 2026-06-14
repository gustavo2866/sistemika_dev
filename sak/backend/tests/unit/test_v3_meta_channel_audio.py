from __future__ import annotations

import pytest

from agente.v3.inbox.queue import V3Inbox
from app.models import Setting
from app.modules.channels.providers.meta.client import MetaMediaDownload
from app.modules.channels.v3 import meta_channel
from app.modules.channels.v3.meta_channel import V3MetaChannel


def _meta_audio_payload() -> dict:
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "1516474752918083",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "metadata": {
                                "display_phone_number": "5493816259343",
                                "phone_number_id": "1046006975257973",
                            },
                            "messages": [
                                {
                                    "from": "5491156384310",
                                    "id": "wamid.test.v3.audio",
                                    "timestamp": "1779282000",
                                    "type": "audio",
                                    "audio": {
                                        "id": "media-audio-v3",
                                        "mime_type": "audio/ogg; codecs=opus",
                                    },
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }


def _seed_meta_settings(db_session) -> None:
    db_session.add(Setting(clave="channels.meta.access_token", valor="test-token"))
    db_session.add(Setting(clave="channels.meta.phone_number_id", valor="1046006975257973"))
    db_session.commit()


@pytest.mark.asyncio
async def test_v3_meta_channel_transcribes_audio_before_enqueue(db_session, monkeypatch):
    monkeypatch.setattr(meta_channel, "engine", db_session.bind)
    _seed_meta_settings(db_session)

    async def fake_download_media(**kwargs):
        assert kwargs["access_token"] == "test-token"
        assert kwargs["media_id"] == "media-audio-v3"
        return MetaMediaDownload(content=b"fake-audio", mime_type="audio/ogg", file_size=10, sha256="sha")

    async def fake_transcribe_bytes(audio_bytes, **kwargs):
        assert audio_bytes == b"fake-audio"
        assert kwargs["filename"] == "media-audio-v3.ogg"
        assert kwargs["mime_type"] == "audio/ogg"
        return "necesito 3 bolsas de cemento"

    monkeypatch.setattr(meta_channel.meta_graph_client, "download_media", fake_download_media)
    monkeypatch.setattr(meta_channel.audio_transcription_service, "transcribe_bytes", fake_transcribe_bytes)
    inbox = V3Inbox()

    result = await V3MetaChannel().receive(_meta_audio_payload(), inbox=inbox)
    snapshot = await inbox.snapshot()

    assert result["enqueued_count"] == 1
    pending = snapshot["pending"][0]
    assert pending["text"] == "necesito 3 bolsas de cemento"
    assert pending["message_type"] == "audio"


@pytest.mark.asyncio
async def test_v3_meta_channel_marks_audio_transcription_failure(db_session, monkeypatch):
    monkeypatch.setattr(meta_channel, "engine", db_session.bind)
    _seed_meta_settings(db_session)

    async def fake_download_media(**kwargs):
        return MetaMediaDownload(content=b"fake-audio", mime_type="audio/ogg")

    async def fake_transcribe_bytes(audio_bytes, **kwargs):
        raise ValueError("boom")

    monkeypatch.setattr(meta_channel.meta_graph_client, "download_media", fake_download_media)
    monkeypatch.setattr(meta_channel.audio_transcription_service, "transcribe_bytes", fake_transcribe_bytes)
    captured = []

    def after_enqueue(messages):
        captured.extend(messages)

    await V3MetaChannel().receive(_meta_audio_payload(), inbox=V3Inbox(), after_enqueue=after_enqueue)

    assert captured[0].text == "[Audio recibido]"
    audio_meta = captured[0].normalized_payload["mensaje"]["audio"]
    assert audio_meta["transcription_status"] == "failed"
    assert "boom" in audio_meta["transcription_error"]
