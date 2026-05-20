"""Meta provider implementation."""

from __future__ import annotations

from sqlmodel import Session

from app.modules.channels.config import meta_account_resolver
from app.modules.channels.persistence import channel_event_store
from app.modules.channels.types import ChannelEventData, DeliveryResult, SendMessageCommand
from app.modules.channels.utils import normalize_address, normalize_phone_for_meta
from .client import meta_graph_client


class MetaProvider:
    provider = "meta"
    channel_type = "whatsapp"

    async def send_message(self, session: Session, command: SendMessageCommand) -> DeliveryResult:
        account_config = meta_account_resolver.resolve(session, command.account_ref)
        within_window = channel_event_store.has_recent_inbound(
            session,
            provider=self.provider,
            channel_type=self.channel_type,
            account_ref=command.account_ref,
            contact_address=command.to_address,
        )

        message_type = self._resolve_message_type(command, within_window)
        payload = self._build_payload(command, message_type)

        try:
            meta_response = await meta_graph_client.send_message(
                access_token=account_config.access_token,
                phone_number_id=account_config.phone_number_id,
                payload=payload,
            )
            external_message_id = meta_response.get("messages", [{}])[0].get("id")
            channel_event_store.record(
                session,
                ChannelEventData(
                    provider=self.provider,
                    channel_type=self.channel_type,
                    account_ref=command.account_ref,
                    external_account_id=account_config.phone_number_id,
                    direction="outbound",
                    from_address=account_config.phone_number_id,
                    to_address=command.to_address,
                    external_message_id=external_message_id,
                    status="sent",
                    raw_payload=meta_response,
                    normalized_payload={
                        "request": payload,
                        "message_type": message_type,
                        "to_address": normalize_address(command.to_address),
                    },
                ),
            )
            session.commit()
            return DeliveryResult(
                status="sent",
                external_message_id=external_message_id,
                provider_message_type=message_type,
                raw_response=meta_response,
            )
        except Exception as exc:
            channel_event_store.record(
                session,
                ChannelEventData(
                    provider=self.provider,
                    channel_type=self.channel_type,
                    account_ref=command.account_ref,
                    external_account_id=account_config.phone_number_id,
                    direction="outbound",
                    from_address=account_config.phone_number_id,
                    to_address=command.to_address,
                    status="failed",
                    normalized_payload={
                        "request": payload,
                        "message_type": message_type,
                        "error": str(exc),
                    },
                ),
            )
            session.commit()
            raise

    def _resolve_message_type(self, command: SendMessageCommand, within_window: bool) -> str:
        if command.policy == "text_only":
            return "text"
        if command.policy == "template_only":
            return "template"
        return "text" if within_window else "template"

    def _build_payload(self, command: SendMessageCommand, message_type: str) -> dict:
        to_normalized = normalize_phone_for_meta(command.to_address)
        if message_type == "text":
            return {
                "messaging_product": "whatsapp",
                "to": to_normalized,
                "type": "text",
                "text": {"body": command.text},
            }

        nombre = command.contact_name or "Cliente"
        components = [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": nombre},
                    {"type": "text", "text": command.text},
                ],
            }
        ]
        return {
            "messaging_product": "whatsapp",
            "to": to_normalized,
            "type": "template",
            "template": {
                "name": command.template_fallback_name,
                "language": {"code": command.template_fallback_language},
                "components": components,
            },
        }


meta_provider = MetaProvider()

