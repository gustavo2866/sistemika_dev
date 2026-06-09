"""Public entry point for channel operations used by SAK."""

from __future__ import annotations

from sqlmodel import Session

from app.db import engine
from .persistence import channel_event_store
from .providers.meta.provider import meta_provider
from .types import ChannelEventData, MarkReadCommand, SendMessageCommand


class ChannelGateway:
    async def mark_read(
        self,
        session: Session,
        *,
        provider: str,
        channel_type: str,
        account_ref: str,
        external_message_id: str,
        contact_address: str | None = None,
        business_address: str | None = None,
    ) -> dict:
        command = MarkReadCommand(
            provider=provider,
            channel_type=channel_type,
            account_ref=account_ref,
            external_message_id=external_message_id,
            contact_address=contact_address,
            business_address=business_address,
            show_typing=False,
        )
        result = await meta_provider.mark_message_read(session, command)
        return result.to_provider_response_dict()

    async def show_typing(
        self,
        session: Session,
        *,
        provider: str,
        channel_type: str,
        account_ref: str,
        external_message_id: str,
        contact_address: str | None = None,
        business_address: str | None = None,
    ) -> dict:
        command = MarkReadCommand(
            provider=provider,
            channel_type=channel_type,
            account_ref=account_ref,
            external_message_id=external_message_id,
            contact_address=contact_address,
            business_address=business_address,
            show_typing=True,
        )
        result = await meta_provider.mark_message_read(session, command)
        return result.to_provider_response_dict()

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
        policy: str = "auto",
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
            policy=policy,  # type: ignore[arg-type]
        )
        with Session(engine) as session:
            result = await meta_provider.send_message(session, command)
            return result.to_provider_response_dict()

    def record_event(self, session: Session, event: ChannelEventData) -> None:
        channel_event_store.record(session, event)


channel_gateway = ChannelGateway()
