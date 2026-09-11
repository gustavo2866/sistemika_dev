from __future__ import annotations

import asyncio
from datetime import date

from sqlmodel import Session, select

from agente.v3.contracts import V3ConversationContext, V3InboundMessage
from agente.v3.subprocesses.parte_diario.handler import ParteDiarioSubprocess
from agente.v3.subprocesses.parte_diario.models import ParteDiarioOperation, ParteDiarioState, TurnPlan
from app.db import engine
from app.models import CRMOportunidad, Proyecto


MESSAGE_TEXT = "ruiz trabajo 5hs en axion"
TARGET_DATE = date(2026, 9, 3)


class FakeLLM:
    async def interpret_turn(self, mensaje, state, nominas_proyecto, estados):
        return TurnPlan(
            operations=[
                ParteDiarioOperation(
                    type="agregar_novedad",
                    nombre="ruiz",
                    estado_codigo="P",
                    horas=5,
                )
            ]
        )

    async def interpretar_estado_pendiente(self, mensaje, estados):
        return "PER"

    async def contextual_reply(self, **kwargs):
        return "contextual"


def make_message(text: str) -> V3InboundMessage:
    return V3InboundMessage(
        id="sim-msg",
        provider="meta",
        channel_type="whatsapp",
        account_ref="account",
        conversation_id="meta:account:549111111",
        external_message_id="sim-ruiz-axion-5h",
        from_address="549111111",
        to_address="549999999",
        text=text,
        message_type="text",
        raw_payload={},
        normalized_payload={},
    )


async def main() -> None:
    with Session(engine) as session:
        project = session.exec(select(Proyecto).where(Proyecto.nombre.contains("Francia 118"))).first()
        if project is None:
            print("missing Francia 118 project")
            return
        opportunity = session.get(CRMOportunidad, project.oportunidad_id) if project.oportunidad_id else None
        if opportunity is None:
            print("missing Francia 118 opportunity")
            return
        context = V3ConversationContext(
            conversation_id="meta:account:549111111",
            active_process="parteDiario",
            process_state={
                "etapa": "carga",
                "contacto_id": opportunity.contacto_id,
                "oportunidad_id": opportunity.id,
                "proyecto_id": project.id,
                "nombre_obra": project.nombre,
                "parte_state": ParteDiarioState(
                    oportunidad_id=opportunity.id,
                    idproyecto=project.id,
                    fecha=TARGET_DATE.isoformat(),
                ).to_dict(),
            },
        )

    result = await ParteDiarioSubprocess(llm_client=FakeLLM()).handle(
        make_message(MESSAGE_TEXT),
        context,
    )
    draft = result.context.process_state.get("parte_state", {})
    pending = (draft.get("pendientes_ambiguos") or [{}])[0]
    print("mensaje=", MESSAGE_TEXT)
    print("fecha=", TARGET_DATE.isoformat())
    print("status=", result.status)
    print("novedades=", len(draft.get("novedades") or []))
    print("pendientes=", len(draft.get("pendientes_ambiguos") or []))
    print("destino_pendiente=", pending.get("destino_pendiente"))
    print("validar_destino_trabajo=", pending.get("validar_destino_trabajo"))
    print("idnomina_resuelto=", pending.get("idnomina_resuelto"))
    print("idproyecto_destino=", pending.get("idproyecto_destino"))
    print("contacto_id_destino=", pending.get("contacto_id_destino"))
    print("reply=", (result.reply_text or "").replace("\n", " | "))


asyncio.run(main())
