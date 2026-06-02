"""Cliente LLM con outputs estructurados para parte_diario."""

from __future__ import annotations

import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from openai import APIConnectionError, APIStatusError, AsyncOpenAI, AuthenticationError

from agente.v2.processes.parte_diario.models import (
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


def _parse_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


class ParteDiarioLLMClient:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        raw_key = api_key or os.getenv("OPENAI_API_KEY") or ""
        self.api_key = raw_key.strip() or None
        self.model = model or os.getenv("OPENAI_CHAT_REPLY_MODEL", "gpt-4.1-mini")
        self._client: AsyncOpenAI | None = None

    async def interpret_turn(
        self,
        mensaje: str,
        state: ParteDiarioState,
        nominas_proyecto: list[NominaItem],
        estados: list[EstadoItem],
    ) -> TurnPlan:
        prompt = (PROMPTS_DIR / "interpretar_turno.txt").read_text(encoding="utf-8").strip()
        payload = {
            "mensaje": mensaje,
            "fecha_actual": datetime.now(BUENOS_AIRES).date().isoformat(),
            "zona_horaria": "America/Argentina/Buenos_Aires",
            "parte": state.to_dict(),
            "nomina_proyecto": [item.nombre_completo for item in nominas_proyecto],
            "estados_activos": [
                {"codigo": item.abreviatura, "nombre": item.nombre}
                for item in estados
            ],
        }
        started = time.perf_counter()
        raw = await self._call(prompt.replace("{turno}", _compact(payload)), self._turn_schema(estados))
        plan = self._parse_turn_plan(raw)
        plan.llm_ms = round((time.perf_counter() - started) * 1000)
        return plan

    async def interpretar_estado_pendiente(self, mensaje: str, estados: list[EstadoItem]) -> str:
        prompt = (
            "Interpreta el motivo de asistencia. Devuelve solo un codigo permitido o "
            "NO_DETERMINADO. No inventes codigos.\n"
            f"Estados: {_compact([{'codigo': item.abreviatura, 'nombre': item.nombre} for item in estados])}\n"
            f"Mensaje: {mensaje}"
        )
        raw = await self._call(prompt, self._pending_state_schema(estados))
        return str(raw.get("estado_codigo") or "NO_DETERMINADO").upper()

    async def _call(self, system_prompt: str, response_format: dict[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY no configurada")
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self.api_key)
        try:
            completion = await self._client.chat.completions.create(
                model=self.model,
                response_format=response_format,
                max_tokens=1000,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": "Interpreta el turno y responde solo JSON."},
                ],
            )
        except APIConnectionError as exc:
            raise ValueError("No se pudo conectar a OpenAI") from exc
        except AuthenticationError as exc:
            raise ValueError("OPENAI_API_KEY invalida") from exc
        except APIStatusError as exc:
            raise ValueError(f"OpenAI error HTTP {exc.status_code}") from exc
        message = completion.choices[0].message
        refusal = getattr(message, "refusal", None)
        if refusal:
            raise ValueError("LLM rechazo interpretar el turno")
        try:
            parsed = json.loads((message.content or "").strip())
        except json.JSONDecodeError as exc:
            raise ValueError("LLM no devolvio JSON valido") from exc
        if not isinstance(parsed, dict):
            raise ValueError("LLM debe devolver un objeto JSON")
        return parsed

    def _parse_turn_plan(self, raw: dict[str, Any]) -> TurnPlan:
        operations: list[ParteDiarioOperation] = []
        for item in raw.get("operations") or []:
            if not isinstance(item, dict):
                continue
            operation_type = str(item.get("type") or "").strip()
            if not operation_type:
                continue
            operations.append(
                ParteDiarioOperation(
                    type=operation_type,
                    nombre=str(item.get("nombre") or "").strip() or None,
                    estado_codigo=str(item.get("estado_codigo") or "").strip().upper() or None,
                    horas=_parse_float(item.get("horas")),
                    horas_extra=_parse_float(item.get("horas_extra")),
                    descripcion=str(item.get("descripcion") or "").strip() or None,
                    fecha=str(item.get("fecha") or "").strip() or None,
                    requested=str(item.get("requested") or "").strip() or None,
                    reply=str(item.get("reply") or "").strip() or None,
                )
            )
        return TurnPlan(
            operations=operations,
            reply=str(raw.get("reply") or "").strip() or None,
            raw_response=raw,
        )

    @staticmethod
    def _turn_schema(estados: list[EstadoItem]) -> dict[str, Any]:
        codes = [item.abreviatura.upper() for item in estados]
        return {
            "type": "json_schema",
            "json_schema": {
                "name": "parte_diario_turn_plan",
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

    @staticmethod
    def _pending_state_schema(estados: list[EstadoItem]) -> dict[str, Any]:
        codes = [item.abreviatura.upper() for item in estados]
        return {
            "type": "json_schema",
            "json_schema": {
                "name": "parte_diario_estado_pendiente",
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
