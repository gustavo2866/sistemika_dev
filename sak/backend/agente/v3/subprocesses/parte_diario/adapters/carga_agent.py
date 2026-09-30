"""Agent SDK para carga conversacional de parte diario."""

from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel, Field

from agente.v3.llm import AgentSDKClient
from agente.v3.subprocesses.parte_diario.adapters.model_config import resolve_parte_diario_model
from agente.v3.subprocesses.parte_diario.domain.models import NominaItem, PendienteAmbiguo
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text
from agente.v3.subprocesses.parte_diario.domain.empleados import parse_candidate_selection


class ParteDiarioCargaAgentOutput(BaseModel):
    action: Literal["seleccionar_persona", "procesar_como_novedad", "pedir_aclaracion"]
    candidate_id: int | None = Field(default=None)
    text: str | None = Field(default=None)
    reason: str | None = Field(default=None)


class ParteDiarioCargaAgentClient:
    """Resuelve respuestas conversacionales durante la carga del parte."""

    def __init__(self, *, model: str | None = None, reasoning_effort: str | None = None) -> None:
        self.model, self.reasoning_effort = resolve_parte_diario_model(
            model,
            specific_model_env="OPENAI_PARTE_DIARIO_CARGA_AGENT_MODEL",
            reasoning_effort=reasoning_effort,
        )

    async def resolve_person_validation(
        self,
        *,
        message_text: str,
        pending: PendienteAmbiguo,
    ) -> ParteDiarioCargaAgentOutput:
        candidates = _visible_candidates(pending)
        tools = _build_tools(candidates)
        client = AgentSDKClient(
            name="sak_parte_diario_carga_v3",
            model=self.model,
            reasoning_effort=self.reasoning_effort,
            instructions=CARGA_AGENT_INSTRUCTIONS,
            output_type=ParteDiarioCargaAgentOutput,
            tools=tools,
        )
        output = await client.run(
            json.dumps(
                {
                    "message_text": message_text,
                    "pending_name": pending.nombre,
                    "candidates": [item.to_dict() for item in candidates],
                },
                ensure_ascii=False,
            )
        )
        return output  # type: ignore[return-value]


def fallback_person_validation(message_text: str, pending: PendienteAmbiguo) -> ParteDiarioCargaAgentOutput:
    command = normalize_text(message_text).upper()
    if command in {"NINGUNO", "NINGUNA", "NINGUNO DE ESOS", "NINGUNA DE ESAS"}:
        return ParteDiarioCargaAgentOutput(action="pedir_aclaracion", reason="fallback_none")
    selected = parse_candidate_selection(message_text, _visible_candidates(pending))
    if selected is not None:
        return ParteDiarioCargaAgentOutput(
            action="seleccionar_persona",
            candidate_id=selected.idnomina,
            reason="fallback_candidate_match",
        )
    if _looks_like_attendance_update(message_text):
        return ParteDiarioCargaAgentOutput(action="procesar_como_novedad", text=message_text, reason="fallback_new_load")
    return ParteDiarioCargaAgentOutput(action="pedir_aclaracion", reason="fallback_unclear")


def _build_tools(candidates: list[NominaItem]) -> list[Any]:
    try:
        from agents import function_tool
    except ImportError as exc:
        raise RuntimeError("openai-agents no esta instalado") from exc

    @function_tool
    def resolver_candidato(texto: str) -> dict[str, Any]:
        """Busca una persona dentro de los candidatos visibles usando nombre, apellido, legajo o numero."""
        selected = parse_candidate_selection(texto, candidates)
        if selected is None:
            return {"status": "no_match"}
        return {"status": "match", "candidate": selected.to_dict()}

    @function_tool
    def detectar_novedad(texto: str) -> dict[str, Any]:
        """Detecta si el texto parece una nueva novedad."""
        return {"looks_like_attendance_update": _looks_like_attendance_update(texto)}

    return [resolver_candidato, detectar_novedad]


def _visible_candidates(pending: PendienteAmbiguo) -> list[NominaItem]:
    return pending.candidatos or []


def _looks_like_attendance_update(text: str | None) -> bool:
    tokens = set(normalize_text(text).split())
    update_terms = {
        "falto",
        "falta",
        "faltaron",
        "ausente",
        "enfermo",
        "enfermedad",
        "accidente",
        "vacaciones",
        "permiso",
        "presente",
        "trabajo",
        "vino",
        "horas",
        "hora",
        "hs",
    }
    return bool(tokens & update_terms)


CARGA_AGENT_INSTRUCTIONS = """
Sos el agente de carga de parte diario de obra.

Tu tarea en este punto es resolver una aclaracion de persona pendiente.

Reglas:
- Solo se puede elegir una persona de los candidatos enviados, pertenecientes a la nomina vigente de la obra y encargado. Nunca registrar sin validar; si no hay coincidencia, pedir_aclaracion.
- Si el usuario identifica un candidato por nombre, apellido, legajo o numero, usa resolver_candidato y devolve action="seleccionar_persona" con candidate_id.
- Si el usuario escribe una nueva novedad en vez de aclarar la persona, usa detectar_novedad y devolve action="procesar_como_novedad" con text igual al mensaje original.
- Si no alcanza para decidir, devolve action="pedir_aclaracion".
- No guardes, no cierres y no inventes candidatos.
- Responde siempre con la salida estructurada.
""".strip()
