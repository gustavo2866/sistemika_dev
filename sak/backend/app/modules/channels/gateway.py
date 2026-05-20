"""Public entry point for channel operations used by SAK."""

from __future__ import annotations

from sqlmodel import Session

from app.db import engine
from .persistence import channel_event_store
from .providers.meta.provider import meta_provider
from .types import ChannelEventData, SendMessageCommand


class ChannelGateway:
    async def enviar_mensaje(
        self,
        *,
        empresa_id: str,
        celular_id: str,
        telefono_destino: str,
        texto: str,
        nombre_contacto: str | None = None,
        template_fallback_name: str = "notificacion_general",
        template_fallback_language: str = "en",
    ) -> dict:
        command = SendMessageCommand(
            provider="meta",
            channel_type="whatsapp",
            company_ref=empresa_id,
            account_ref=celular_id,
            to_address=telefono_destino,
            text=texto,
            contact_name=nombre_contacto,
            template_fallback_name=template_fallback_name,
            template_fallback_language=template_fallback_language,
            policy="auto",
        )
        with Session(engine) as session:
            result = await meta_provider.send_message(session, command)
            return result.to_metaw_compatible_dict()

    def record_event(self, session: Session, event: ChannelEventData) -> None:
        channel_event_store.record(session, event)


channel_gateway = ChannelGateway()
