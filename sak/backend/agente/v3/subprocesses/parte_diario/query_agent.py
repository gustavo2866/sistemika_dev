"""Agente SDK read-only para consultas contextuales de parte diario."""

from __future__ import annotations

import json
import os
from typing import Any

from pydantic import BaseModel, Field
from sqlmodel import Session

from agente.v3.llm import AgentSDKClient
from agente.v3.subprocesses.parte_diario.process import _today
from agente.v3.subprocesses.parte_diario.query_service import ParteDiarioQueryService


class ParteDiarioQueryAgentOutput(BaseModel):
    respuesta: str = Field(description="Respuesta final para el usuario.")


class ParteDiarioQueryAgentClient:
    """Configura un Agent SDK con tools internas read-only del parte diario."""

    def __init__(self, *, model: str | None = None) -> None:
        self.model = model or os.getenv("OPENAI_PARTE_DIARIO_QUERY_AGENT_MODEL") or os.getenv(
            "OPENAI_CHAT_REPLY_MODEL",
            "gpt-4.1-mini",
        )

    async def respond(
        self,
        *,
        session: Session,
        message_text: str,
        etapa: str,
        proyecto_id: int,
        contacto_id: int | None,
        nombre_obra: str | None,
        opciones_visibles: list[dict[str, Any]] | None = None,
    ) -> str:
        service = ParteDiarioQueryService(
            session=session,
            proyecto_id=proyecto_id,
            contacto_id=contacto_id,
            nombre_obra=nombre_obra,
        )
        tools = _build_tools(service)
        client = AgentSDKClient(
            name="sak_parte_diario_query_v3",
            model=self.model,
            instructions=QUERY_AGENT_INSTRUCTIONS,
            output_type=ParteDiarioQueryAgentOutput,
            tools=tools,
        )
        output = await client.run(
            json.dumps(
                {
                    "message_text": message_text,
                    "etapa": etapa,
                    "proyecto_id": proyecto_id,
                    "contacto_id": contacto_id,
                    "obra": nombre_obra,
                    "fecha_referencia": _today().isoformat(),
                    "opciones_visibles": opciones_visibles or [],
                },
                ensure_ascii=False,
            )
        )
        return str(output.respuesta or "").strip()


def _build_tools(service: ParteDiarioQueryService) -> list[Any]:
    try:
        from agents import function_tool
    except ImportError as exc:
        raise RuntimeError("openai-agents no esta instalado") from exc

    @function_tool
    def consultar_novedades(
        desde: str | None = None,
        hasta: str | None = None,
        estado_codigo: str | None = None,
        persona: str | None = None,
        incluir_presentes: bool = False,
        horas_igual_a: float | None = None,
        horas_menor_que: float | None = None,
        horas_mayor_que: float | None = None,
        solo_horas_extras: bool = False,
        alcance_personal: str | None = "todos",
        agrupar_por: str | None = "fecha",
    ) -> str:
        """Consulta novedades del parte diario por rango, estado, persona, horas, extras y alcance de nomina."""
        return service.consultar_novedades(
            desde=desde,
            hasta=hasta,
            estado_codigo=estado_codigo,
            persona=persona,
            incluir_presentes=incluir_presentes,
            horas_igual_a=horas_igual_a,
            horas_menor_que=horas_menor_que,
            horas_mayor_que=horas_mayor_que,
            solo_horas_extras=solo_horas_extras,
            alcance_personal=alcance_personal,
            agrupar_por=agrupar_por,
        )

    @function_tool
    def consultar_partes(
        desde: str | None = None,
        hasta: str | None = None,
        estado_parte: str | None = None,
        incluir_sin_cargar: bool = False,
    ) -> str:
        """Consulta estados de partes diarios por rango, con opcion de incluir fechas sin cargar."""
        return service.consultar_partes(
            desde=desde,
            hasta=hasta,
            estado_parte=estado_parte,
            incluir_sin_cargar=incluir_sin_cargar,
        )

    @function_tool
    def consultar_contexto_parte(tipo: str) -> str:
        """Consulta contexto de la obra actual: obra, nomina, nomina_completa o estados."""
        return service.consultar_contexto_parte(tipo=tipo, pedido_usuario=message_text)

    return [consultar_novedades, consultar_partes, consultar_contexto_parte]


QUERY_AGENT_INSTRUCTIONS = """
Sos un asistente contextual de parte diario para una constructora.

Reglas:
- No modifiques datos. No guardes, no cierres, no selecciones opciones y no cargues novedades.
- Si el usuario pide informacion interna del parte diario, usa las tools disponibles.
- Las consultas de partes y novedades ya estan limitadas a la obra actual; no intentes consultar fuera de ese alcance.
- Para nomina/personal/empleados sin aclaracion, usa consultar_contexto_parte(tipo="nomina"). Debe responder la nomina del proyecto activo, no un subconjunto por encargado.
- Solo si el usuario pide explicitamente "toda la nomina", "nomina completa" o equivalente, usa consultar_contexto_parte(tipo="nomina_completa").
- Para fechas, usa formato ISO YYYY-MM-DD. Resolve referencias relativas usando fecha_referencia del input.
- Para novedades, ausencias, faltas, accidentes, permisos, presentes u horas, usa consultar_novedades.
- Regla de horas: la nomina de la obra que trabaja normal no aparece como novedad y se asume 9h.
- En nomina de la obra, una novedad con 0h es ausencia y el estado indica el motivo; entre 0h y 9h es trabajo parcial con motivo; mas de 9h debe ser estado P y el excedente sobre 9h son horas extras.
- Personal de otra nomina solo registra las horas destinadas a esta obra; esas horas no son horas extras de esta obra. Si preguntas por ese personal, usa alcance_personal="otra_nomina" o "todos" y aclara que es otra nomina.
- "Faltar", "falto", "no trabajo" o "quienes no trabajaron" significa estar reportado con horas=0; no depende del motivo. Usa consultar_novedades con horas_igual_a=0.
- Para "quien falto", usa consultar_novedades con horas_igual_a=0 sin persona.
- Para "falto Ruiz?", usa consultar_novedades con horas_igual_a=0 y persona="Ruiz".
- Para motivos especificos como accidente, enfermedad, permiso, licencia o vacaciones, usa estado_codigo correspondiente si esta disponible.
- Para "quien tuvo accidente", usa consultar_novedades con estado_codigo="ACC".
- Para "quien trabajo menos de 8 horas", usa consultar_novedades con horas_menor_que=8 e incluir_presentes=true si corresponde.
- Para "horas extras" o "quienes hicieron extras", usa consultar_novedades con solo_horas_extras=true y agrupar_por="persona".
- Para estados de partes, pendientes, borradores, confirmados o fechas sin cargar, usa consultar_partes.
- Para estados disponibles u obra seleccionada, usa consultar_contexto_parte.
- Si la consulta es informativa general y no requiere datos internos, responde con conocimiento general solo si estas seguro.
- No inventes datos internos ni datos actuales. Si no tenes informacion suficiente, decilo.
- Responde en espanol rioplatense, breve y directo.
- Al final no expliques el mecanismo; el sistema volvera automaticamente al menu actual.
""".strip()
