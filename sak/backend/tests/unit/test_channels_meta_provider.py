from datetime import UTC, datetime

import pytest

from app.models import Setting
from app.modules.channels.persistence import channel_event_store
from app.modules.channels.providers.meta.provider import meta_provider
from app.modules.channels.types import ChannelEventData, MarkReadCommand, SendMessageCommand


@pytest.fixture()
def meta_settings(db_session):
    db_session.add(Setting(clave="channels.meta.access_token", valor="test-token"))
    db_session.add(Setting(clave="channels.meta.default_phone_number_id", valor="123456"))
    db_session.commit()


@pytest.mark.asyncio
async def test_meta_provider_show_typing_marks_inbound_message_as_read(db_session, meta_settings, monkeypatch):
    captured = {}

    async def fake_mark_message_read(**kwargs):
        captured.update(kwargs)
        return {"success": True}

    monkeypatch.setattr(
        "app.modules.channels.providers.meta.provider.meta_graph_client.mark_message_read",
        fake_mark_message_read,
    )

    result = await meta_provider.mark_message_read(
        db_session,
        MarkReadCommand(
            provider="meta",
            channel_type="whatsapp",
            account_ref="account-1",
            external_message_id="wamid.inbound",
            contact_address="5491122233344",
            business_address="5491100000000",
            show_typing=True,
        ),
    )

    assert result.status == "read_with_typing"
    assert captured["phone_number_id"] == "123456"
    assert captured["message_id"] == "wamid.inbound"
    assert captured["show_typing"] is True


@pytest.mark.asyncio
async def test_meta_provider_sends_text_inside_24h_window(db_session, meta_settings, monkeypatch):
    captured = {}

    async def fake_send_message(**kwargs):
        captured.update(kwargs)
        return {"messages": [{"id": "wamid.text"}]}

    monkeypatch.setattr(
        "app.modules.channels.providers.meta.provider.meta_graph_client.send_message",
        fake_send_message,
    )
    channel_event_store.record(
        db_session,
        ChannelEventData(
            provider="meta",
            channel_type="whatsapp",
            account_ref="account-1",
            direction="inbound",
            from_address="5491122233344",
            to_address="5491100000000",
            external_message_id="wamid.in",
            occurred_at=datetime.now(UTC),
        ),
    )

    result = await meta_provider.send_message(
        db_session,
        SendMessageCommand(
            provider="meta",
            channel_type="whatsapp",
            account_ref="account-1",
            to_address="5491122233344",
            text="Pedido confirmado",
        ),
    )

    assert result.status == "sent"
    assert result.external_message_id == "wamid.text"
    assert captured["phone_number_id"] == "123456"
    assert captured["payload"]["type"] == "text"


@pytest.mark.asyncio
async def test_meta_provider_uses_template_without_recent_inbound(db_session, meta_settings, monkeypatch):
    captured = {}

    async def fake_send_message(**kwargs):
        captured.update(kwargs)
        return {"messages": [{"id": "wamid.template"}]}

    monkeypatch.setattr(
        "app.modules.channels.providers.meta.provider.meta_graph_client.send_message",
        fake_send_message,
    )

    result = await meta_provider.send_message(
        db_session,
        SendMessageCommand(
            provider="meta",
            channel_type="whatsapp",
            account_ref="account-1",
            to_address="5491122233344",
            text="Pedido confirmado",
            contact_name="Juan",
        ),
    )

    assert result.status == "sent"
    assert result.external_message_id == "wamid.template"
    assert captured["payload"]["type"] == "template"
    assert captured["payload"]["template"]["name"] == "notificacion_general"

