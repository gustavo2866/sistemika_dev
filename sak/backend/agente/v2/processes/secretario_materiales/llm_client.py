from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any
from dataclasses import dataclass, field

import openai
from openai import AsyncOpenAI, APIConnectionError, APIStatusError, AuthenticationError

from agente.v2.processes.solicitud_materiales.models import ItemOperation


PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
TURN_PROMPT_PATH = PROMPTS_DIR / "turn.txt"

# Prompt cacheado en memoria con invalidacion por mtime
_PROMPT_CACHE: dict[Path, tuple[float, str]] = {}


def _load_prompt(path: Path) -> str:
    mtime = path.stat().st_mtime
    cached = _PROMPT_CACHE.get(path)
    if cached is None or cached[0] != mtime:
        _PROMPT_CACHE[path] = (mtime, path.read_text(encoding="utf-8").strip())
    return _PROMPT_CACHE[path][1]


def _compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _sanitize(value: str | None) -> str | None:
    text = (value or "").strip()
    return text or None


def _compact_families(families: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Reduce el catálogo de familias a solo lo necesario para el LLM: codigo + tags."""
    return [
        {"codigo": f.get("codigo"), "tags": f.get("tags", [])}
        for f in families
        if f.get("codigo")
    ]


@dataclass(slots=True)
class SecretarioTurnDecision:
    """Resultado parseado del LLM para el secretario."""

    decision_type: str  # "material_operation" | "show" | "chat"
    reply: str | None = None
    observation: str | None = None
    operations: list[ItemOperation] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


class SecretarioLLMClient:
    """Cliente LLM del proceso secretario_materiales — un solo prompt por turno."""

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = _sanitize(api_key or os.getenv("OPENAI_API_KEY"))
        self.model = model or os.getenv("OPENAI_CHAT_REPLY_MODEL", "gpt-4.1-mini")
        self._client: AsyncOpenAI | None = None

    async def process_turn(
        self,
        *,
        message_text: str,
        history: list[dict[str, Any]],
        current_request: dict[str, Any] | None,
        families: list[dict[str, Any]],
    ) -> SecretarioTurnDecision:
        # Solo los items ya registrados — sin historial de mensajes
        items_actuales = (current_request or {}).get("items", [])
        items_compactos = [
            {"item_id": it.get("item_id"), "descripcion": it.get("descripcion_actual") or it.get("descripcion"),
             "familia": it.get("familia"), "cantidad": it.get("cantidad"), "unidad": it.get("unidad")}
            for it in items_actuales
        ]

        payload = {
            "mensaje": message_text,
            "solicitud_actual": items_compactos,
            "familias": _compact_families(families),
        }
        result = await self._call_llm(_load_prompt(TURN_PROMPT_PATH), payload)
        return self._parse(result)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _call_llm(self, system_prompt: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY no configurada")

        if self._client is None:
            self._client = AsyncOpenAI(api_key=self.api_key)

        try:
            completion = await self._client.chat.completions.create(
                model=self.model,
                response_format={"type": "json_object"},
                max_tokens=400,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": _compact_json(payload)},
                ],
            )
        except APIConnectionError as exc:
            raise ValueError("No se pudo conectar a OpenAI") from exc
        except AuthenticationError as exc:
            raise ValueError("OPENAI_API_KEY invalida o vencida") from exc
        except APIStatusError as exc:
            if exc.status_code in {401, 403}:
                raise ValueError("No se pudo autenticar contra OpenAI") from exc
            raise ValueError(f"OpenAI devolvio error HTTP {exc.status_code}") from exc

        raw = (completion.choices[0].message.content or "").strip()
        if not raw:
            raise ValueError("El agente secretario no devolvio contenido")

        try:
            result = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError("El agente secretario no devolvio JSON valido") from exc

        if not isinstance(result, dict):
            raise ValueError("El agente secretario debe devolver un objeto JSON")
        return result

    def _parse(self, payload: dict[str, Any]) -> SecretarioTurnDecision:
        decision_type = str(payload.get("decision_type") or "chat").strip().lower()
        if decision_type not in {"material_operation", "show", "chat"}:
            decision_type = "chat"

        operations: list[ItemOperation] = []
        for raw_op in payload.get("operations") or []:
            if not isinstance(raw_op, dict):
                continue
            action = self._normalize_action(raw_op.get("action"))
            if not action:
                continue
            operations.append(
                ItemOperation(
                    action=action,
                    target_item_id=_sanitize(str(raw_op.get("target_item_id") or "")) or None,
                    descripcion=_sanitize(str(raw_op.get("descripcion") or "")) or None,
                    familia=_sanitize(str(raw_op.get("familia") or "")) or None,
                    cantidad=self._parse_quantity(raw_op.get("cantidad")),
                    unidad=_sanitize(str(raw_op.get("unidad") or "")) or None,
                    atributos=dict(raw_op.get("atributos") or {}),
                )
            )

        return SecretarioTurnDecision(
            decision_type=decision_type,
            reply=_sanitize(str(payload.get("reply") or "")) or None,
            observation=_sanitize(str(payload.get("observation") or "")) or None,
            operations=operations,
            warnings=[str(w).strip() for w in payload.get("warnings") or [] if str(w).strip()],
        )

    @staticmethod
    def _normalize_action(value: Any) -> str | None:
        aliases = {
            "add": "add",
            "update": "update",
            "remove": "remove",
            "clear_request": "clear_request",
            "clear": "clear_request",
        }
        return aliases.get(str(value or "").strip().lower())

    @staticmethod
    def _parse_quantity(value: Any) -> float | int | None:
        if value is None or value == "" or isinstance(value, bool):
            return None
        try:
            num = float(str(value).replace(",", "."))
        except (TypeError, ValueError):
            return None
        if num <= 0:
            return None
        return int(num) if num.is_integer() else num
