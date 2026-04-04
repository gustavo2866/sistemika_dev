from __future__ import annotations

from sqlmodel import Session

from agente.v2.core.models import SendResult, SendTextCommand
from app.services.crm_mensaje_service import crm_mensaje_service


class CRMOutboundChannelAdapter:
    """Adaptador de salida que reutiliza el servicio CRM existente."""

    async def send_text(self, session: Session, command: SendTextCommand) -> SendResult:
        send_result = await crm_mensaje_service.enviar_mensaje(
            session,
            {
                "contenido": command.contenido,
                "contacto_id": command.contacto_id,
                "oportunidad_id": command.oportunidad_id,
                "responsable_id": command.responsable_id,
                "contacto_referencia": command.contacto_referencia,
                "canal": command.canal,
                "metadata": command.metadata,
            },
        )
        sent_status = str(send_result.get("status") or "")
        sent_message = send_result.get("mensaje_salida")
        return SendResult(
            sent=sent_status not in {"failed", ""},
            status=sent_status or "sent",
            outbound_message_id=getattr(sent_message, "id", None),
            meta_message_id=send_result.get("meta_message_id"),
            error_message=send_result.get("error_message"),
        )
