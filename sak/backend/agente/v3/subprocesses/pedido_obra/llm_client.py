"""Cliente LLM para interpretar etapas de pedidoObra v3."""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from agente.v3.llm import OpenAIChatClient, compact_json, load_prompt
from agente.v3.subprocesses.pedido_obra.interpreter import PedidoObraOperation
from agente.v3.subprocesses.pedido_obra.state import PedidoObraState


PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

OPERATIONS_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "pedido_obra_v3_carga_plan",
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
                            "type": {"type": "string", "enum": ["insert", "update", "delete", "clear", "show"]},
                            "descripcion": {"type": ["string", "null"]},
                            "cantidad": {"type": ["number", "null"]},
                            "unidad": {"type": ["string", "null"]},
                            "target": {"type": ["string", "null"]},
                        },
                        "required": ["type", "descripcion", "cantidad", "unidad", "target"],
                    },
                },
            },
            "required": ["operations"],
        },
    },
}


class PedidoObraCargaLLMClient:
    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        *,
        chat_client: OpenAIChatClient | None = None,
    ) -> None:
        self._chat = chat_client or OpenAIChatClient(api_key=api_key, model=model)

    async def interpret_carga(self, message: str | None, state: PedidoObraState) -> tuple[list[PedidoObraOperation], int]:
        prompt = load_prompt(PROMPTS_DIR / "carga.txt")
        system_prompt = (
            prompt.replace("{turno}", compact_json({"mensaje": message or ""}))
            .replace("{estado}", compact_json(state.to_dict()))
        )
        started = time.perf_counter()
        raw = await self._chat.complete_json(
            system_prompt=system_prompt,
            response_format=OPERATIONS_RESPONSE_FORMAT,
            max_tokens=500,
        )
        return _parse_operations(raw), round((time.perf_counter() - started) * 1000)

    async def interpret_cierre(self, message: str | None, state: PedidoObraState) -> tuple[list[PedidoObraOperation], int]:
        prompt = load_prompt(PROMPTS_DIR / "cierre.txt")
        system_prompt = (
            prompt.replace("{turno}", compact_json({"mensaje": message or ""}))
            .replace("{estado}", compact_json(state.to_dict()))
        )
        started = time.perf_counter()
        raw = await self._chat.complete_json(
            system_prompt=system_prompt,
            response_format=OPERATIONS_RESPONSE_FORMAT,
            max_tokens=500,
        )
        return _parse_operations(raw), round((time.perf_counter() - started) * 1000)


def _parse_operations(raw: dict[str, Any]) -> list[PedidoObraOperation]:
    operations: list[PedidoObraOperation] = []
    raw_operations = raw.get("operations")
    if not isinstance(raw_operations, list):
        return operations
    for raw_operation in raw_operations:
        if not isinstance(raw_operation, dict):
            continue
        op_type = str(raw_operation.get("type") or "").strip()
        if op_type not in {"insert", "update", "delete", "clear", "show"}:
            continue
        operations.append(
            PedidoObraOperation(
                type=op_type,  # type: ignore[arg-type]
                descripcion=str(raw_operation.get("descripcion") or "").strip() or None,
                cantidad=_parse_float(raw_operation.get("cantidad")),
                unidad=str(raw_operation.get("unidad") or "").strip() or None,
                target=str(raw_operation.get("target") or "").strip() or None,
            )
        )
    return operations


def _parse_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
