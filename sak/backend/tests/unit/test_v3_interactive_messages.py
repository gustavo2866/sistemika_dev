from __future__ import annotations

import pytest

from agente.v3.contracts import V3OutboundMessage
from agente.v3.inbox.queue import V3Inbox
from agente.v3.outbox.queue import V3Outbox
from app.modules.channels.v3 import meta_channel
from app.modules.channels.v3.meta_channel import V3MetaChannel


def _meta_payload(message: dict) -> dict:
    return {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "metadata": {
                                "phone_number_id": "phone-1",
                                "display_phone_number": "549999999",
                            },
                            "messages": [message],
                        }
                    }
                ]
            }
        ]
    }


def test_v3_meta_channel_extracts_list_reply_id() -> None:
    messages = meta_channel._raw_meta_to_v3_inbound_messages(
        _meta_payload(
            {
                "id": "wamid-list-1",
                "from": "549111111",
                "type": "interactive",
                "interactive": {
                    "type": "list_reply",
                    "list_reply": {
                        "id": "parte_fecha:2026-07-01",
                        "title": "01/07/2026",
                    },
                },
            }
        )
    )

    assert messages[0].message_type == "interactive"
    assert messages[0].text == "parte_fecha:2026-07-01"
    assert messages[0].normalized_payload["mensaje"]["texto"] == "parte_fecha:2026-07-01"


def test_v3_meta_channel_extracts_button_reply_id() -> None:
    messages = meta_channel._raw_meta_to_v3_inbound_messages(
        _meta_payload(
            {
                "id": "wamid-button-1",
                "from": "549111111",
                "type": "interactive",
                "interactive": {
                    "type": "button_reply",
                    "button_reply": {
                        "id": "parte_accion:cerrar",
                        "title": "CERRAR",
                    },
                },
            }
        )
    )

    assert messages[0].message_type == "interactive"
    assert messages[0].text == "parte_accion:cerrar"
    assert messages[0].normalized_payload["mensaje"]["texto"] == "parte_accion:cerrar"


@pytest.mark.asyncio
async def test_v3_meta_channel_dedupes_quick_repeated_interactive_reply() -> None:
    channel = V3MetaChannel()
    inbox = V3Inbox()
    captured: list[list[str]] = []

    def after_enqueue(messages):
        captured.append([message.text for message in messages])

    first = await channel.receive(
        _meta_payload(
            {
                "id": "wamid-list-1",
                "from": "549111111",
                "type": "interactive",
                "interactive": {
                    "type": "list_reply",
                    "list_reply": {
                        "id": "parte_fecha:2026-06-29",
                        "title": "29/06/2026 lun",
                    },
                },
            }
        ),
        inbox=inbox,
        after_enqueue=after_enqueue,
    )
    second = await channel.receive(
        _meta_payload(
            {
                "id": "wamid-list-2",
                "from": "549111111",
                "type": "interactive",
                "interactive": {
                    "type": "list_reply",
                    "list_reply": {
                        "id": "parte_fecha:2026-06-29",
                        "title": "29/06/2026 lun",
                    },
                },
            }
        ),
        inbox=inbox,
        after_enqueue=after_enqueue,
    )

    snapshot = await inbox.snapshot()
    assert first["enqueued_count"] == 1
    assert second["received_count"] == 1
    assert second["enqueued_count"] == 0
    assert second["skipped_duplicates"] == 1
    assert snapshot["pending_count"] == 1
    assert captured == [["parte_fecha:2026-06-29"]]


@pytest.mark.asyncio
async def test_v3_outbox_sends_interactive_payload(monkeypatch) -> None:
    sent: list[str] = []

    class FakeMetaChannel:
        async def send_text(self, message):
            sent.append("text")
            message.external_message_id = "text-id"
            return message

        async def send_interactive(self, message):
            sent.append("interactive")
            message.external_message_id = "interactive-id"
            return message

    monkeypatch.setattr(meta_channel, "default_meta_channel", FakeMetaChannel())
    outbox = V3Outbox()
    await outbox.enqueue(
        V3OutboundMessage(
            id="out-1",
            provider="meta",
            channel_type="whatsapp",
            account_ref="account",
            to_address="549111111",
            text="fallback",
            source_message_id="in-1",
            payload_type="interactive",
            interactive={"type": "button", "body": {"text": "Elegir"}, "action": {"buttons": []}},
        )
    )

    result = await outbox.process_next()

    assert sent == ["interactive"]
    assert result is not None
    assert result["payload_type"] == "interactive"
    assert result["external_message_id"] == "interactive-id"


@pytest.mark.asyncio
async def test_v3_outbox_falls_back_to_text_when_interactive_fails(monkeypatch) -> None:
    sent: list[str] = []

    class FakeMetaChannel:
        async def send_text(self, message):
            sent.append("text")
            message.external_message_id = "text-id"
            message.raw_response = {"messages": [{"id": "text-id"}]}
            return message

        async def send_interactive(self, message):
            sent.append("interactive")
            raise RuntimeError("interactive rejected")

    monkeypatch.setattr(meta_channel, "default_meta_channel", FakeMetaChannel())
    outbox = V3Outbox()
    await outbox.enqueue(
        V3OutboundMessage(
            id="out-1",
            provider="meta",
            channel_type="whatsapp",
            account_ref="account",
            to_address="549111111",
            text="Selecciona la fecha del parte diario:\n1: 04/07/2026 sab",
            source_message_id="in-1",
            payload_type="interactive",
            interactive={"type": "list", "body": {"text": "Elegir"}, "action": {"sections": []}},
        )
    )

    result = await outbox.process_next()

    assert sent == ["interactive", "text"]
    assert result is not None
    assert result["status"] == "sent"
    assert result["payload_type"] == "text"
    assert result["external_message_id"] == "text-id"
