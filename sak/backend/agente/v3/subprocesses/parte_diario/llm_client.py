"""Cliente LLM para interpretar etapas de parteDiario v3."""

from __future__ import annotations

import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from openai import APIConnectionError, APIStatusError, AsyncOpenAI, AuthenticationError

from agente.v3.subprocesses.parte_diario.models import (
    EstadoItem,
    NominaItem,
    ParteDiarioOperation,
    ParteDiarioState,
    TurnPlan,
)


PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
BUENOS_AIRES = ZoneInfo("America/Argentina/Buenos_Aires")
_PROMPT_CACHE: dict[Path, tuple[float, str]] = {}

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
        client: AsyncOpenAI | None = None,
    ) -> None:
        api_key_raw = api_key or os.getenv("OPENAI_API_KEY") or ""
        self.api_key = api_key_raw.strip() or None
        self.model = model or os.getenv("OPENAI_CHAT_REPLY_MODEL", "gpt-4.1-mini")
        self.stage = stage
        self._client: AsyncOpenAI | None = client

    def for_stage(self, stage: str) -> "ParteDiarioLLMClient":
        return ParteDiarioLLMClient(
            api_key=self.api_key,
            model=self.model,
            stage=stage,
            client=self._client,
        )

    async def interpret_turn(
        self,
        mensaje: str,
        state: ParteDiarioState,
        nominas_proyecto: list[NominaItem],
        estados: list[EstadoItem],
    ) -> TurnPlan:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY no configurada")
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self.api_key)

        prompt = _load_prompt(PROMPTS_DIR / _prompt_name_for_stage(self.stage))
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
        system_prompt = (
            prompt.replace("{turno}", _compact(payload))
            .replace("{estado}", _compact(state.to_dict()))
            .replace("{etapa}", self.stage)
        )
        started = time.perf_counter()
        raw = await self._call(system_prompt, _turn_schema(estados))
        plan = _parse_turn_plan(raw)
        plan.llm_ms = round((time.perf_counter() - started) * 1000)
        return plan

    async def interpretar_estado_pendiente(self, mensaje: str, estados: list[EstadoItem]) -> str:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY no configurada")
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self.api_key)

        prompt = _load_prompt(PROMPTS_DIR / "estado_pendiente.txt")
        system_prompt = (
            prompt.replace(
                "{estados}",
                _compact([{"codigo": item.abreviatura, "nombre": item.nombre} for item in estados]),
            )
            .replace("{mensaje}", mensaje)
        )
        raw = await self._call(system_prompt, _pending_state_schema(estados))
        return str(raw.get("estado_codigo") or "NO_DETERMINADO").upper()

    async def _call(self, system_prompt: str, response_format: dict[str, Any]) -> dict[str, Any]:
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


def _prompt_name_for_stage(stage: str) -> str:
    if stage == "cierre":
        return "cierre.txt"
    return "carga.txt"


def _load_prompt(path: Path) -> str:
    mtime = path.stat().st_mtime
    cached = _PROMPT_CACHE.get(path)
    if cached is None or cached[0] != mtime:
        _PROMPT_CACHE[path] = (mtime, path.read_text(encoding="utf-8").strip())
    return _PROMPT_CACHE[path][1]


def _compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


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
