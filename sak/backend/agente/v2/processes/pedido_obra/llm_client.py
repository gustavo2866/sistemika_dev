"""Cliente LLM para el proceso pedido_obra."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from openai import AsyncOpenAI, APIConnectionError, APIStatusError, AuthenticationError

from agente.v2.processes.pedido_obra.models import PedidoItem, PedidoState
from agente.v2.processes.pedido_obra.parser import ParsedItem


PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

_PROMPT_CACHE: dict[Path, tuple[float, str]] = {}


def _load_prompt(path: Path) -> str:
    mtime = path.stat().st_mtime
    cached = _PROMPT_CACHE.get(path)
    if cached is None or cached[0] != mtime:
        _PROMPT_CACHE[path] = (mtime, path.read_text(encoding="utf-8").strip())
    return _PROMPT_CACHE[path][1]


def _compact(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _pedido_actual_dict(state: PedidoState) -> dict[str, Any]:
    return {
        "etapa": state.etapa,
        "esperando": state.esperando,
        "items": [i.to_dict() for i in state.items],
    }


# ---------------------------------------------------------------------------
# Dataclasses de respuesta
# ---------------------------------------------------------------------------

from dataclasses import dataclass, field


@dataclass(slots=True)
class LLMClasificacionInicial:
    categoria: str   # "materiales" | "comando" | "cierre" | "generico"
    items: list[ParsedItem] = field(default_factory=list)
    comando: str | None = None
    reply: str | None = None


@dataclass(slots=True)
class LLMOperacionCarga:
    type: str
    items: list[ParsedItem] = field(default_factory=list)
    target_descripcion: str | None = None
    nueva_descripcion: str | None = None
    cantidad: float | None = None
    unidad: str | None = None
    reply: str | None = None


@dataclass(slots=True)
class LLMEvaluacionCarga:
    intent: str   # "item" | "comando_*" | "cierre" | "offtopic"
    items: list[ParsedItem] = field(default_factory=list)
    target_descripcion: str | None = None
    nueva_descripcion: str | None = None
    cantidad: float | None = None
    unidad: str | None = None
    reply: str | None = None
    operations: list[LLMOperacionCarga] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Cliente
# ---------------------------------------------------------------------------

class PedidoObraLLMClient:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        api_key_raw = api_key or os.getenv("OPENAI_API_KEY") or ""
        self.api_key = api_key_raw.strip() or None
        self.model = model or os.getenv("OPENAI_CHAT_REPLY_MODEL", "gpt-4.1-mini")
        self._client: AsyncOpenAI | None = None

    async def clasificar_inicial(self, mensaje: str, state: PedidoState) -> LLMClasificacionInicial:
        prompt = _load_prompt(PROMPTS_DIR / "clasificar_inicial.txt")
        prompt = prompt.replace("{pedido_actual}", _compact(_pedido_actual_dict(state)))
        prompt = prompt.replace("{mensaje}", mensaje)
        raw = await self._call(prompt)
        return self._parse_clasificacion(raw)

    async def evaluar_carga(self, mensaje: str, state: PedidoState) -> LLMEvaluacionCarga:
        prompt = _load_prompt(PROMPTS_DIR / "evaluar_carga.txt")
        prompt = prompt.replace("{pedido_actual}", _compact(_pedido_actual_dict(state)))
        prompt = prompt.replace("{mensaje}", mensaje)
        raw = await self._call(prompt)
        return self._parse_evaluacion(raw)

    # -----------------------------------------------------------------------
    # Internal
    # -----------------------------------------------------------------------

    async def _call(self, system_prompt: str) -> dict[str, Any]:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY no configurada")
        if self._client is None:
            self._client = AsyncOpenAI(api_key=self.api_key)
        try:
            completion = await self._client.chat.completions.create(
                model=self.model,
                response_format={"type": "json_object"},
                max_tokens=700,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": "Procesá el mensaje indicado en el prompt."},
                ],
            )
        except APIConnectionError as exc:
            raise ValueError("No se pudo conectar a OpenAI") from exc
        except AuthenticationError as exc:
            raise ValueError("OPENAI_API_KEY inválida") from exc
        except APIStatusError as exc:
            raise ValueError(f"OpenAI error HTTP {exc.status_code}") from exc

        raw = (completion.choices[0].message.content or "").strip()
        if not raw:
            raise ValueError("LLM no devolvió contenido")
        try:
            result = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError("LLM no devolvió JSON válido") from exc
        if not isinstance(result, dict):
            raise ValueError("LLM debe devolver un objeto JSON")
        return result

    @staticmethod
    def _parse_items(raw_items: Any) -> list[ParsedItem]:
        if not isinstance(raw_items, list):
            return []
        results = []
        for it in raw_items:
            if not isinstance(it, dict):
                continue
            desc = str(it.get("descripcion") or "").strip()
            if not desc:
                continue
            raw_cant = it.get("cantidad")
            try:
                cantidad = float(raw_cant) if raw_cant is not None else None
            except (TypeError, ValueError):
                cantidad = None
            unidad = str(it.get("unidad") or "").strip() or None
            results.append(ParsedItem(descripcion=desc, cantidad=cantidad, unidad=unidad))
        return results

    @staticmethod
    def _parse_float(value: Any) -> float | None:
        try:
            return float(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    def _parse_operation(self, raw: Any) -> LLMOperacionCarga | None:
        if not isinstance(raw, dict):
            return None
        op_type = str(raw.get("type") or raw.get("intent") or "").strip().lower()
        if not op_type:
            return None
        return LLMOperacionCarga(
            type=op_type,
            items=self._parse_items(raw.get("items")),
            target_descripcion=str(raw.get("target_descripcion") or raw.get("target") or "").strip() or None,
            nueva_descripcion=str(raw.get("nueva_descripcion") or raw.get("new_description") or "").strip() or None,
            cantidad=self._parse_float(raw.get("cantidad")),
            unidad=str(raw.get("unidad") or "").strip() or None,
            reply=str(raw.get("reply") or "").strip() or None,
        )

    def _parse_operations(self, raw_operations: Any) -> list[LLMOperacionCarga]:
        if not isinstance(raw_operations, list):
            return []
        operations: list[LLMOperacionCarga] = []
        for raw in raw_operations:
            operation = self._parse_operation(raw)
            if operation is not None:
                operations.append(operation)
        return operations

    @staticmethod
    def _legacy_operation_type(intent: str) -> str:
        mapping = {
            "item": "add_items",
            "comando_quitar": "remove_item",
            "comando_modificar": "update_item",
            "comando_limpiar": "clear_order",
            "comando_mostrar": "show_order",
            "cierre": "finish_order",
            "offtopic": "offtopic",
        }
        return mapping.get(intent, intent or "offtopic")

    def _parse_clasificacion(self, raw: dict[str, Any]) -> LLMClasificacionInicial:
        return LLMClasificacionInicial(
            categoria=str(raw.get("categoria") or "generico").strip().lower(),
            items=self._parse_items(raw.get("items")),
            comando=str(raw.get("comando") or "").strip().lower() or None,
            reply=str(raw.get("reply") or "").strip() or None,
        )

    def _parse_evaluacion(self, raw: dict[str, Any]) -> LLMEvaluacionCarga:
        cantidad = self._parse_float(raw.get("cantidad"))
        intent = str(raw.get("intent") or "offtopic").strip().lower()
        operations = self._parse_operations(raw.get("operations"))
        if not operations:
            operations = [
                LLMOperacionCarga(
                    type=self._legacy_operation_type(intent),
                    items=self._parse_items(raw.get("items")),
                    target_descripcion=str(raw.get("target_descripcion") or "").strip() or None,
                    nueva_descripcion=str(raw.get("nueva_descripcion") or "").strip() or None,
                    cantidad=cantidad,
                    unidad=str(raw.get("unidad") or "").strip() or None,
                    reply=str(raw.get("reply") or "").strip() or None,
                )
            ]
        return LLMEvaluacionCarga(
            intent=intent,
            items=self._parse_items(raw.get("items")),
            target_descripcion=str(raw.get("target_descripcion") or "").strip() or None,
            nueva_descripcion=str(raw.get("nueva_descripcion") or "").strip() or None,
            cantidad=cantidad,
            unidad=str(raw.get("unidad") or "").strip() or None,
            reply=str(raw.get("reply") or "").strip() or None,
            operations=operations,
        )
