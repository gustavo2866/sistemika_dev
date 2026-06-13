"""Typing/read indicators for agente v3 channel messages."""

from __future__ import annotations

import logging

from sqlmodel import Session

from agente.v3.contracts import V3InboundMessage
from app.db import engine
from app.modules.channels.gateway import channel_gateway

logger = logging.getLogger(__name__)


async def show_typing_for_inbound_message(message: V3InboundMessage) -> None:
    """Marca el inbound como leido y muestra typing indicator de forma best-effort."""

    if message.provider != "meta" or message.channel_type != "whatsapp" or not message.external_message_id:
        return

    try:
        with Session(engine) as session:
            await channel_gateway.show_typing(
                session,
                provider=message.provider,
                channel_type=message.channel_type,
                account_ref=message.account_ref,
                external_message_id=message.external_message_id,
                contact_address=message.from_address,
                business_address=message.to_address,
            )
    except Exception:
        logger.warning(
            "No se pudo mostrar typing indicator v3 para external_message_id=%s",
            message.external_message_id,
            exc_info=True,
        )
