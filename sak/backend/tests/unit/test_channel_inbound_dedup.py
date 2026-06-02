from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import CRMMensaje
from app.modules.channels.persistence import channel_event_store
from app.modules.channels.types import ChannelEventData


def _inbound_event(external_message_id: str) -> ChannelEventData:
    return ChannelEventData(
        provider="meta",
        channel_type="whatsapp",
        account_ref="account-1",
        direction="inbound",
        from_address="+54 9 11 1234-5678",
        external_message_id=external_message_id,
        occurred_at=datetime.now(UTC),
    )


def test_channel_event_store_reuses_active_inbound_event(db_session):
    first = channel_event_store.record(db_session, _inbound_event("wamid.test.duplicate"))
    second = channel_event_store.record(db_session, _inbound_event("wamid.test.duplicate"))

    assert first.id is not None
    assert second.id == first.id


def test_crm_inbound_external_message_id_is_unique_while_active(db_session):
    db_session.add(
        CRMMensaje(
            tipo="entrada",
            origen_externo_id="wamid.test.crm.duplicate",
        )
    )
    db_session.commit()

    db_session.add(
        CRMMensaje(
            tipo="entrada",
            origen_externo_id="wamid.test.crm.duplicate",
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_crm_outbound_external_message_id_can_repeat(db_session):
    db_session.add_all(
        [
            CRMMensaje(
                tipo="salida",
                origen_externo_id="wamid.test.crm.outbound",
            ),
            CRMMensaje(
                tipo="salida",
                origen_externo_id="wamid.test.crm.outbound",
            ),
        ]
    )

    db_session.commit()
