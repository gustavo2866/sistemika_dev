"""Cliente LLM para interpretar etapas de parteDiario v3."""

from __future__ import annotations

import time
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from agente.v3.llm import OpenAIChatClient, compact_json, load_prompt
from agente.v3.subprocesses.parte_diario.models import (
    EstadoItem,
    NominaItem,
    ParteDiarioOperation,
    ParteDiarioState,
    TurnPlan,
)


PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
BUENOS_AIRES = ZoneInfo("America/Argentina/Buenos_Aires")

OPERATION_TYPES = [
    "agregar_novedad",
    "modificar_novedad",
    "eliminar_novedad",
    "set_fecha",
    "mostrar_parte",
    "mostrar_nomina",
    "sin_novedades",
    "solicitar_confirmacion",
    "solicitar_cancelacion",
    "offtopic",
    "request_other_process",
]


class ParteDiarioLLMClient:
    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        *,
        stage: str = "carga",
        chat_client: OpenAIChatClient | None = None,
    ) -> None:
        self.stage = stage
        self._chat = chat_client or OpenAIChatClient(api_key=api_key, model=model)

    def for_stage(self, stage: str) -> "ParteDiarioLLMClient":
        return ParteDiarioLLMClient(
            stage=stage,
            chat_client=self._chat,
        )

    async def interpret_turn(
        self,
        mensaje: str,
        state: ParteDiarioState,
        nominas_proyecto: list[NominaItem],
        estados: list[EstadoItem],
    ) -> TurnPlan:
        prompt = load_prompt(PROMPTS_DIR / _prompt_name_for_stage(self.stage))
        payload = {
            "mensaje": mensaje,
            "fecha_referencia": datetime.now(BUENOS_AIRES).date().isoformat(),
            "zona_horaria": "America/Argentina/Buenos_Aires",
            "parte": state.to_dict(),
            "nomina_proyecto": [item.nombre_completo for item in nominas_proyecto],
            "estados_activos": [
                {"codigo": item.abreviatura, "nombre": item.nombre}
                for item in estados
            ],
        }
        system_prompt = (
            prompt.replace("{turno}", compact_json(payload))
            .replace("{estado}", compact_json(state.to_dict()))
            .replace("{etapa}", self.stage)
        )
        started = time.perf_counter()
        raw = await self._chat.complete_json(
            system_prompt=system_prompt,
            response_format=_turn_schema(estados),
            max_tokens=1000,
        )
        plan = _parse_turn_plan(raw)
        plan.llm_ms = round((time.perf_counter() - started) * 1000)
        return plan

    async def interpretar_estado_pendiente(self, mensaje: str, estados: list[EstadoItem]) -> str:
        prompt = load_prompt(PROMPTS_DIR / "estado_pendiente.txt")
        system_prompt = (
            prompt.replace(
                "{estados}",
                compact_json([{"codigo": item.abreviatura, "nombre": item.nombre} for item in estados]),
            )
            .replace("{mensaje}", mensaje)
        )
        raw = await self._chat.complete_json(
            system_prompt=system_prompt,
            response_format=_pending_state_schema(estados),
            max_tokens=1000,
        )
        return str(raw.get("estado_codigo") or "NO_DETERMINADO").upper()

    async def contextual_reply(
        self,
        *,
        mensaje: str,
        etapa: str,
        obra: str | None = None,
        opciones_visibles: list[dict[str, Any]] | None = None,
    ) -> str:
        payload = {
            "mensaje": mensaje,
            "etapa": etapa,
            "obra": obra,
            "opciones_visibles": opciones_visibles or [],
        }
        system_prompt = (
            "Sos un asistente acotado dentro del proceso de parte diario.\n"
            "El usuario esta en una etapa controlada y el backend ya intento resolver comandos y selecciones.\n"
            "Tu tarea es responder brevemente el mensaje del usuario y luego el sistema volvera automaticamente a la etapa actual.\n"
            "No ejecutes acciones, no selecciones opciones, no cargues novedades, no guardes y no cierres el parte.\n"
            "Regla prioritaria: si el usuario hace una consulta informativa que no modifica el parte, respondela primero. "
            "No respondas solo con una instruccion de menu ante una pregunta informativa.\n"
            "Para consultas informativas, usa informacion interna del contexto si existe, o conocimiento general del mundo si estas seguro.\n"
            "No inventes datos. Si la consulta requiere informacion actual, externa o especifica que no esta disponible en el contexto, "
            "deci explicitamente que no tenes ese dato disponible en este paso.\n"
            "Si el usuario intenta operar el parte fuera de las opciones visibles, indica que debe usar el menu actual.\n"
            "No cierres con instrucciones largas: si hace falta, recorda en una frase que para continuar debe volver al menu visible.\n"
            "Responde en espanol rioplatense, maximo tres frases.\n\n"
            f"Contexto: {compact_json(payload)}"
        )
        raw = await self._chat.complete_json(
            system_prompt=system_prompt,
            response_format=_contextual_reply_schema(),
            user_content="Responde solo JSON con una ayuda breve.",
            max_tokens=250,
        )
        reply = str(raw.get("reply") or "").strip()
        return reply or "Primero elegi una opcion del menu para continuar."


def _prompt_name_for_stage(stage: str) -> str:
    if stage == "cierre":
        return "cierre.txt"
    return "carga.txt"


def _parse_turn_plan(raw: dict[str, Any]) -> TurnPlan:
    operations: list[ParteDiarioOperation] = []
    raw_operations = raw.get("operations")
    if not isinstance(raw_operations, list):
        return TurnPlan(reply=str(raw.get("reply") or "").strip() or None, raw_response=raw)
    for raw_operation in raw_operations:
        if not isinstance(raw_operation, dict):
            continue
        operation_type = str(raw_operation.get("type") or "").strip()
        if operation_type not in OPERATION_TYPES:
            continue
        operations.append(
            ParteDiarioOperation(
                type=operation_type,
                nombre=str(raw_operation.get("nombre") or "").strip() or None,
                estado_codigo=str(raw_operation.get("estado_codigo") or "").strip().upper() or None,
                horas=_parse_float(raw_operation.get("horas")),
                horas_extra=_parse_float(raw_operation.get("horas_extra")),
                descripcion=str(raw_operation.get("descripcion") or "").strip() or None,
                fecha=str(raw_operation.get("fecha") or "").strip() or None,
                requested=str(raw_operation.get("requested") or "").strip() or None,
                reply=str(raw_operation.get("reply") or "").strip() or None,
            )
        )
    return TurnPlan(
        operations=operations,
        reply=str(raw.get("reply") or "").strip() or None,
        raw_response=raw,
    )


def _parse_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _turn_schema(estados: list[EstadoItem]) -> dict[str, Any]:
    codes = [item.abreviatura.upper() for item in estados]
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "parte_diario_v3_turn_plan",
            "strict": True,
            "schema": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "operations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "type": {"type": "string", "enum": OPERATION_TYPES},
                                "nombre": {"type": ["string", "null"]},
                                "estado_codigo": {"enum": [*codes, None]},
                                "horas": {"type": ["number", "null"]},
                                "horas_extra": {"type": ["number", "null"]},
                                "descripcion": {"type": ["string", "null"]},
                                "fecha": {"type": ["string", "null"]},
                                "requested": {"type": ["string", "null"]},
                                "reply": {"type": ["string", "null"]},
                            },
                            "required": [
                                "type",
                                "nombre",
                                "estado_codigo",
                                "horas",
                                "horas_extra",
                                "descripcion",
                                "fecha",
                                "requested",
                                "reply",
                            ],
                        },
                    },
                    "reply": {"type": ["string", "null"]},
                },
                "required": ["operations", "reply"],
            },
        },
    }


def _pending_state_schema(estados: list[EstadoItem]) -> dict[str, Any]:
    codes = [item.abreviatura.upper() for item in estados]
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "parte_diario_v3_estado_pendiente",
            "strict": True,
            "schema": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "estado_codigo": {"type": "string", "enum": [*codes, "NO_DETERMINADO"]},
                },
                "required": ["estado_codigo"],
            },
        },
    }


def _contextual_reply_schema() -> dict[str, Any]:
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "parte_diario_v3_contextual_reply",
            "strict": True,
            "schema": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "reply": {"type": "string"},
                },
                "required": ["reply"],
            },
        },
    }
