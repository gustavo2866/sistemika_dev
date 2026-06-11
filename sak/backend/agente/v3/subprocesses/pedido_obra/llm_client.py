"""Cliente LLM para interpretar etapas de pedidoObra v3."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

from openai import APIConnectionError, APIStatusError, AsyncOpenAI, AuthenticationError

from agente.v3.subprocesses.pedido_obra.interpreter import PedidoObraOperation
from agente.v3.subprocesses.pedido_obra.state import PedidoObraState


PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
_PROMPT_CACHE: dict[Path, tuple[float, str]] = {}

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
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        api_key_raw = api_key or os.getenv("OPENAI_API_KEY") or ""
        self.api_key = api_key_raw.strip() or None
        self.model = model or os.getenv("OPENAI_CHAT_REPLY_MODEL", "gpt-4.1-mini")
        self._client: AsyncOpenAI | None = None

    async def interpret_carga(self, message: str | None, state: PedidoObraState) -> tuple[list[PedidoObraOperation], int]:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY no configurada")
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self.api_key)

        prompt = _load_prompt(PROMPTS_DIR / "carga.txt")
        system_prompt = (
            prompt.replace("{turno}", _compact({"mensaje": message or ""}))
            .replace("{estado}", _compact(state.to_dict()))
        )
        started = time.perf_counter()
        raw = await self._call(system_prompt)
        return _parse_operations(raw), round((time.perf_counter() - started) * 1000)

    async def interpret_cierre(self, message: str | None, state: PedidoObraState) -> tuple[list[PedidoObraOperation], int]:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY no configurada")
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self.api_key)

        prompt = _load_prompt(PROMPTS_DIR / "cierre.txt")
        system_prompt = (
            prompt.replace("{turno}", _compact({"mensaje": message or ""}))
            .replace("{estado}", _compact(state.to_dict()))
        )
        started = time.perf_counter()
        raw = await self._call(system_prompt)
        return _parse_operations(raw), round((time.perf_counter() - started) * 1000)

    async def _call(self, system_prompt: str) -> dict[str, Any]:
        try:
            completion = await self._client.chat.completions.create(
                model=self.model,
                response_format=OPERATIONS_RESPONSE_FORMAT,
                max_tokens=500,
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

        content = (completion.choices[0].message.content or "").strip()
        if not content:
            raise ValueError("LLM no devolvio contenido")
        parsed = json.loads(content)
        if not isinstance(parsed, dict):
            raise ValueError("LLM debe devolver un objeto JSON")
        return parsed


def _load_prompt(path: Path) -> str:
    mtime = path.stat().st_mtime
    cached = _PROMPT_CACHE.get(path)
    if cached is None or cached[0] != mtime:
        _PROMPT_CACHE[path] = (mtime, path.read_text(encoding="utf-8").strip())
    return _PROMPT_CACHE[path][1]


def _compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


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
