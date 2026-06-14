import asyncio

from sqlmodel import Session, select

from agente.v3.runtime_registry import get_v3_runtime
from app.models import Setting
from app.modules.channels.persistence import ChannelEvent
from app.routers.channel_meta_webhook_router import process_raw_meta_webhook_payload


def _meta_text_payload(message_id: str = "wamid.test.inline.inbound") -> dict:
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
                                    "id": message_id,
                                    "timestamp": "1779282000",
                                    "type": "text",
                                    "text": {"body": "Hola"},
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }


def test_channel_meta_webhook_verify_returns_plain_challenge(client, db_session: Session):
    db_session.add(Setting(clave="channels.meta.webhook_verify_token", valor="verify-test"))
    db_session.commit()

    response = client.get(
        "/api/channel-webhooks/meta/",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "verify-test",
            "hub.challenge": "abc123",
        },
    )

    assert response.status_code == 200
    assert response.text == "abc123"


def test_channel_meta_webhook_endpoint_derives_inbound_to_v3(client, monkeypatch):
    calls: list[tuple[str, object]] = []

    async def fake_receive(payload, *, inbox, queue_name=None, after_enqueue=None):
        message_id = payload["entry"][0]["changes"][0]["value"]["messages"][0]["id"]
        calls.append(("v3_receive", message_id))
        calls.append(("default_inbox", inbox is get_v3_runtime().inbox))
        calls.append(("queue", queue_name))
        return {"status": "ok"}

    monkeypatch.setattr(
        "app.routers.channel_meta_webhook_router.default_meta_channel.receive",
        fake_receive,
    )

    response = client.post(
        "/api/channel-webhooks/meta/",
        json=_meta_text_payload(),
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Encolado v3"
    assert calls == [
        ("v3_receive", "wamid.test.inline.inbound"),
        ("default_inbox", True),
        ("queue", "default"),
    ]


def test_channel_meta_webhook_endpoint_accepts_smoke_queue_for_v3(client, monkeypatch):
    calls: list[tuple[str, object]] = []

    async def fake_receive(payload, *, inbox, queue_name=None, after_enqueue=None):
        calls.append(("smoke_inbox", inbox is get_v3_runtime("smoke").inbox))
        calls.append(("queue", queue_name))
        return {"status": "ok"}

    monkeypatch.setattr(
        "app.routers.channel_meta_webhook_router.default_meta_channel.receive",
        fake_receive,
    )

    response = client.post(
        "/api/channel-webhooks/meta/",
        params={"queue": "smoke"},
        json=_meta_text_payload("wamid.test.inline.smoke"),
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Encolado v3"
    assert calls == [("smoke_inbox", True), ("queue", "smoke")]


def test_channel_meta_webhook_endpoint_rejects_unknown_v3_queue(client):
    response = client.post(
        "/api/channel-webhooks/meta/",
        params={"queue": "test"},
        json=_meta_text_payload("wamid.test.inline.invalid"),
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "queue invalida: solo se permite 'smoke'"


def test_channel_meta_webhook_endpoint_records_status_callback(client, db_session: Session):
    db_session.add(Setting(clave="channels.meta.phone_number_id", valor="1046006975257973"))
    db_session.commit()

    response = client.post(
        "/api/channel-webhooks/meta/",
        json={
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "metadata": {
                                    "display_phone_number": "5493816259343",
                                    "phone_number_id": "1046006975257973",
                                },
                                "statuses": [
                                    {
                                        "id": "wamid.test.status.outbound",
                                        "status": "delivered",
                                        "timestamp": "1779282000",
                                        "recipient_id": "5491156384310",
                                    }
                                ],
                            }
                        }
                    ]
                }
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Recibido"

    event = db_session.exec(
        select(ChannelEvent).where(ChannelEvent.external_message_id == "wamid.test.status.outbound")
    ).one()
    assert event.direction == "outbound"
    assert event.status == "delivered"
    assert event.from_address == "5493816259343"
    assert event.to_address == "5491156384310"


def test_channel_meta_webhook_raw_message_records_channel_event(db_session: Session):
    db_session.add(Setting(clave="channels.meta.phone_number_id", valor="1046006975257973"))
    db_session.commit()

    asyncio.run(
        process_raw_meta_webhook_payload(
            db_session,
            _meta_text_payload("wamid.test.local.inbound"),
        )
    )

    event = db_session.exec(
        select(ChannelEvent).where(ChannelEvent.external_message_id == "wamid.test.local.inbound")
    ).one()
    assert event.direction == "inbound"
    assert event.status == "received"
    assert event.from_address == "5491156384310"
    assert event.to_address == "5493816259343"
    assert event.normalized_payload["mensaje"]["texto"] == "Hola"
