"""Cliente Agent SDK para el subproceso general v3."""

from __future__ import annotations

import json
import os
from typing import Literal

from pydantic import BaseModel, Field

from agente.v3.llm import AgentSDKClient


GENERAL_MENU_TEXT = "Hola. Puedo ayudarte con:\n1: PEDIDO OBRA\n2: PARTE DIARIO"


class GeneralAgentOutput(BaseModel):
    type: Literal["general_reply", "handoff"] = Field(description="Tipo de respuesta del agente general.")
    target_process: Literal["pedidoObra", "parteDiario"] | None = Field(
        default=None,
        description="Subproceso destino cuando type=handoff.",
    )
    respuesta: str = Field(description="Texto que se debe enviar al usuario.")
    reason: str | None = Field(default=None, description="Razon breve de la decision.")


class GeneralAgentClient:
    """Configura el agente general sobre el wrapper Agent SDK reutilizable."""

    def __init__(self, *, model: str | None = None) -> None:
        self._client = AgentSDKClient(
            name="sak_general_v3",
            model=model or os.getenv("OPENAI_GENERAL_AGENT_MODEL") or os.getenv("OPENAI_CHAT_REPLY_MODEL", "gpt-4.1-mini"),
            instructions=GENERAL_AGENT_INSTRUCTIONS,
            output_type=GeneralAgentOutput,
        )

    async def respond(self, *, message_text: str, conversation_id: str, active_process: str | None) -> GeneralAgentOutput:
        result = await self._client.run(
            json.dumps(
                {
                    "conversation_id": conversation_id,
                    "active_process": active_process,
                    "message_text": message_text,
                },
                ensure_ascii=False,
            ),
        )
        return result  # type: ignore[return-value]


GENERAL_AGENT_INSTRUCTIONS = """
Sos el agente general de SAK para conversaciones de WhatsApp de una constructora.

Objetivo:
- Responder consultas generales simples con brevedad.
- Orientar al usuario para pedir materiales de obra o reportar parte diario.
- No cargar pedidos, no confirmar pedidos y no registrar partes diarios.

Derivacion:
- Si el usuario quiere pedir, comprar, agregar, modificar o consultar materiales, insumos, artefactos o equipos para obra,
  devolve type="handoff" y target_process="pedidoObra".
- Si el usuario quiere reportar asistencia, ausencias, horas, novedades, accidentes, permisos o parte diario,
  devolve type="handoff" y target_process="parteDiario".
- Si el usuario pide "parte pendiente" o "partes pendientes", devolve type="handoff" y target_process="parteDiario".
- Si el mensaje es saludo, duda general o ambiguo, devolve type="general_reply" y target_process=null.

Estilo:
- Responde en espanol rioplatense simple.
- No menciones que sos un LLM.
- No inventes datos internos.
- Si haces handoff, la respuesta debe guiar el proximo paso.

Ejemplos:
- "hola" => general_reply: "Hola. Puedo ayudarte con:\n1: PEDIDO OBRA\n2: PARTE DIARIO"
- "necesito cemento" => handoff pedidoObra: "Perfecto. Decime que materiales necesitas y para que obra."
- "quiero cargar asistencia" => handoff parteDiario: "Perfecto. Pasame la asistencia o novedades del dia."
""".strip()


def fallback_general_response() -> GeneralAgentOutput:
    return GeneralAgentOutput(
        type="general_reply",
        target_process=None,
        respuesta=GENERAL_MENU_TEXT,
        reason="fallback_local",
    )
