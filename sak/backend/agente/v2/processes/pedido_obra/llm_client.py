"""Cliente LLM para interpretar turnos de pedido_obra."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

from openai import APIConnectionError, APIStatusError, AsyncOpenAI, AuthenticationError

from agente.v2.processes.pedido_obra.models import (
    OperationItem,
    PedidoOperation,
    PedidoState,
    TurnPlan,
)


PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
_PROMPT_CACHE: dict[Path, tuple[float, str]] = {}

TURN_PLAN_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "pedido_obra_turn_plan",
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
                            "type": {
                                "type": "string",
                                "enum": [
                                    "add_items",
                                    "update_item",
                                    "remove_item",
                                    "clear_order",
                                    "show_order",
                                    "finish_order",
                                    "solicitar_confirmacion",
                                    "solicitar_cancelacion",
                                    "request_other_process",
                                    "continue_previous",
                                    "start_new_order",
                                    "answer_missing_quantity",
                                    "offtopic",
                                ],
                            },
                            "items": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "additionalProperties": False,
                                    "properties": {
                                        "descripcion": {"type": "string"},
                                        "cantidad": {"type": ["number", "null"]},
                                        "unidad": {"type": ["string", "null"]},
                                    },
                                    "required": ["descripcion", "cantidad", "unidad"],
                                },
                            },
                            "target_item_id": {"type": ["string", "null"]},
                            "target_descripcion": {"type": ["string", "null"]},
                            "nueva_descripcion": {"type": ["string", "null"]},
                            "cantidad": {"type": ["number", "null"]},
                            "unidad": {"type": ["string", "null"]},
                            "reply": {"type": ["string", "null"]},
                        },
                        "required": [
                            "type",
                            "items",
                            "target_item_id",
                            "target_descripcion",
                            "nueva_descripcion",
                            "cantidad",
                            "unidad",
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


def _load_prompt(path: Path) -> str:
    mtime = path.stat().st_mtime
    cached = _PROMPT_CACHE.get(path)
    if cached is None or cached[0] != mtime:
        _PROMPT_CACHE[path] = (mtime, path.read_text(encoding="utf-8").strip())
    return _PROMPT_CACHE[path][1]


def _compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _parse_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class PedidoObraLLMClient:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        api_key_raw = api_key or os.getenv("OPENAI_API_KEY") or ""
        self.api_key = api_key_raw.strip() or None
        self.model = model or os.getenv("OPENAI_CHAT_REPLY_MODEL", "gpt-4.1-mini")
        self._client: AsyncOpenAI | None = None

    async def interpret_turn(self, mensaje: str, state: PedidoState) -> TurnPlan:
        prompt = _load_prompt(PROMPTS_DIR / "interpretar_turno.txt")
        payload = {
            "pedido_actual": state.to_prompt_dict(),
            "mensaje": mensaje,
        }
        started = time.perf_counter()
        raw = await self._call(prompt.replace("{turno}", _compact(payload)))
        plan = self._parse_turn_plan(raw)
        plan.llm_ms = round((time.perf_counter() - started) * 1000)
        return plan

    async def _call(self, system_prompt: str) -> dict[str, Any]:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY no configurada")
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self.api_key)

        try:
            completion = await self._client.chat.completions.create(
                model=self.model,
                response_format=TURN_PLAN_RESPONSE_FORMAT,
                max_tokens=700,
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

        raw = (completion.choices[0].message.content or "").strip()
        if not raw:
            raise ValueError("LLM no devolvio contenido")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError("LLM no devolvio JSON valido") from exc
        if not isinstance(parsed, dict):
            raise ValueError("LLM debe devolver un objeto JSON")
        return parsed

    def _parse_turn_plan(self, raw: dict[str, Any]) -> TurnPlan:
        return TurnPlan(
            operations=self._parse_operations(raw.get("operations")),
            reply=str(raw.get("reply") or "").strip() or None,
            raw_response=raw,
        )

    def _parse_operations(self, raw_operations: Any) -> list[PedidoOperation]:
        if not isinstance(raw_operations, list):
            return []
        operations: list[PedidoOperation] = []
        for raw in raw_operations:
            if not isinstance(raw, dict):
                continue
            op_type = str(raw.get("type") or "").strip().lower()
            if not op_type:
                continue
            operations.append(
                PedidoOperation(
                    type=op_type,
                    items=self._parse_items(raw.get("items")),
                    target_item_id=str(raw.get("target_item_id") or raw.get("item_id") or "").strip() or None,
                    target_descripcion=str(raw.get("target_descripcion") or raw.get("target") or "").strip() or None,
                    nueva_descripcion=str(raw.get("nueva_descripcion") or raw.get("descripcion") or "").strip() or None,
                    cantidad=_parse_float(raw.get("cantidad")),
                    unidad=str(raw.get("unidad") or "").strip() or None,
                    reply=str(raw.get("reply") or "").strip() or None,
                )
            )
        return operations

    @staticmethod
    def _parse_items(raw_items: Any) -> list[OperationItem]:
        if not isinstance(raw_items, list):
            return []
        items: list[OperationItem] = []
        for raw in raw_items:
            if not isinstance(raw, dict):
                continue
            descripcion = str(raw.get("descripcion") or "").strip()
            if not descripcion:
                continue
            items.append(
                OperationItem(
                    descripcion=descripcion,
                    cantidad=_parse_float(raw.get("cantidad")),
                    unidad=str(raw.get("unidad") or "").strip() or None,
                )
            )
        return items
