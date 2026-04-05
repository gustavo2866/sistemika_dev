from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import openai
from openai import APIConnectionError, APIStatusError, AuthenticationError

from agente.v2.shared.text_normalization import normalize_text
from agente.v2.processes.solicitud_materiales.models import (
    ItemOperation,
    MaterialItem,
    MaterialRequestTurnContext,
    NormalTurnDecision,
    PendingTurnDecision,
)


PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
NORMAL_TURN_PROMPT_PATH = PROMPTS_DIR / "normal_turn.txt"
PENDING_ATTRIBUTE_PROMPT_PATH = PROMPTS_DIR / "pending_attribute_turn.txt"
INDEPENDENT_DURING_PENDING_PROMPT_PATH = PROMPTS_DIR / "independent_during_pending.txt"


def _compact_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _sanitize_env_value(value: str | None) -> str | None:
    if value is None:
        return None
    sanitized = value.strip()
    return sanitized or None


class OpenAIConversationAgentClientV2:
    """Cliente OpenAI para el agente conversacional v2."""

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = _sanitize_env_value(api_key or os.getenv("OPENAI_API_KEY"))
        self.model = model or os.getenv("OPENAI_CHAT_REPLY_MODEL", "gpt-4.1-mini")
        self._client: openai.OpenAI | None = None

    def interpret_normal_turn(
        self,
        context: MaterialRequestTurnContext,
        prompt_families: list[dict[str, Any]],
    ) -> NormalTurnDecision:
        payload = self._run_json_prompt(
            NORMAL_TURN_PROMPT_PATH,
            {
                "oportunidad_id": context.oportunidad_id,
                "mensaje_objetivo": context.mensaje_objetivo.to_prompt_dict(),
                "recent_messages": [message.to_prompt_dict() for message in context.recent_messages],
                "agent_state": context.agent_state.to_state_dict(),
                "active_process_state": context.active_process_state,
                "runtime": context.runtime.to_dict(),
                "solicitud_actual": context.request_state.to_analysis_dict() if context.request_state else None,
                "familias": prompt_families,
            },
        )
        return self._parse_normal_turn(payload)

    def reply_independent_during_pending(
        self,
        context: MaterialRequestTurnContext,
        pending_item: MaterialItem,
        pending_attribute: dict[str, Any],
    ) -> str:
        """Genera una respuesta para un mensaje fuera de contexto durante una consulta pendiente.

        Responde al mensaje del usuario y retoma la repregunta del atributo pendiente.
        """
        payload = self._run_json_prompt(
            INDEPENDENT_DURING_PENDING_PROMPT_PATH,
            {
                "mensaje_objetivo": context.mensaje_objetivo.to_prompt_dict(),
                "recent_messages": [m.to_prompt_dict() for m in context.recent_messages],
                "consulta_pendiente": {
                    "item_id": pending_item.item_id,
                    "descripcion": pending_item.descripcion,
                    "familia": pending_item.familia,
                    "consulta": pending_item.consulta,
                    "consulta_atributo": pending_item.consulta_atributo,
                    "atributo": pending_attribute,
                },
            },
        )
        reply = self._to_optional_str(payload.get("reply_to_user"))
        return reply or (pending_item.consulta or "")

    def classify_pending_turn(
        self,
        context: MaterialRequestTurnContext,
        pending_item: MaterialItem,
        pending_attribute: dict[str, Any],
    ) -> PendingTurnDecision:
        payload = self._run_json_prompt(
            PENDING_ATTRIBUTE_PROMPT_PATH,
            {
                "oportunidad_id": context.oportunidad_id,
                "mensaje_objetivo": context.mensaje_objetivo.to_prompt_dict(),
                "recent_messages": [message.to_prompt_dict() for message in context.recent_messages],
                "agent_state": context.agent_state.to_state_dict(),
                "active_process_state": context.active_process_state,
                "runtime": context.runtime.to_dict(),
                "solicitud_actual": context.request_state.to_analysis_dict() if context.request_state else None,
                "consulta_pendiente": {
                    "item_id": pending_item.item_id,
                    "descripcion": pending_item.descripcion,
                    "familia": pending_item.familia,
                    "consulta": pending_item.consulta,
                    "consulta_atributo": pending_item.consulta_atributo,
                    "consulta_intentos": pending_item.consulta_intentos,
                    "atributo": pending_attribute,
                },
            },
        )
        return self._parse_pending_turn(payload)

    def _run_json_prompt(self, prompt_path: Path, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY no configurada")

        if self._client is None:
            self._client = openai.OpenAI(api_key=self.api_key)

        prompt = "\n\n".join(
            [
                prompt_path.read_text(encoding="utf-8").strip(),
                "CONTEXTO:",
                _compact_json(payload),
            ]
        )

        try:
            completion = self._client.responses.create(
                model=self.model,
                input=prompt,
                text={"format": {"type": "json_object"}},
                max_output_tokens=500,
            )
        except APIConnectionError as exc:
            raise ValueError("No se pudo conectar a OpenAI") from exc
        except AuthenticationError as exc:
            raise ValueError("OPENAI_API_KEY invalida o vencida") from exc
        except APIStatusError as exc:
            if exc.status_code in {401, 403}:
                raise ValueError("No se pudo autenticar contra OpenAI") from exc
            raise ValueError(f"OpenAI devolvio error HTTP {exc.status_code}") from exc

        raw_parts: list[str] = []
        for output in getattr(completion, "output", []) or []:
            for content in getattr(output, "content", []) or []:
                text = getattr(content, "text", None)
                if text:
                    raw_parts.append(text)

        raw_payload = "\n".join(part.strip() for part in raw_parts if part and part.strip()).strip()
        if not raw_payload:
            raise ValueError("El agente v2 no devolvio contenido")

        try:
            parsed_payload = json.loads(raw_payload)
        except json.JSONDecodeError as exc:
            raise ValueError("El agente v2 no devolvio un JSON valido") from exc

        if not isinstance(parsed_payload, dict):
            raise ValueError("El agente v2 debe devolver un objeto JSON")
        return parsed_payload

    def _parse_normal_turn(self, payload: dict[str, Any]) -> NormalTurnDecision:
        decision_type = normalize_text(payload.get("decision_type")) or "no_op"
        if decision_type not in {"smalltalk", "request_operation", "no_op"}:
            decision_type = "no_op"

        operations: list[ItemOperation] = []
        for raw_operation in payload.get("operations") or []:
            if not isinstance(raw_operation, dict):
                continue
            action = self._normalize_operation_action(raw_operation.get("action"))
            if not action:
                continue
            operations.append(
                ItemOperation(
                    action=action,
                    target_item_id=self._to_optional_str(raw_operation.get("target_item_id")),
                    descripcion=self._to_optional_str(raw_operation.get("descripcion")),
                    familia=self._to_optional_str(raw_operation.get("familia")),
                    cantidad=self._normalize_quantity(raw_operation.get("cantidad")),
                    unidad=self._to_optional_str(raw_operation.get("unidad")),
                    atributos=dict(raw_operation.get("atributos") or {}),
                )
            )

        return NormalTurnDecision(
            decision_type=decision_type,  # type: ignore[arg-type]
            reply_to_user=self._to_optional_str(payload.get("reply_to_user")),
            operations=operations,
            confidence=self._to_optional_float(payload.get("confidence")),
            warnings=[str(item).strip() for item in payload.get("warnings") or [] if str(item).strip()],
        )

    def _parse_pending_turn(self, payload: dict[str, Any]) -> PendingTurnDecision:
        decision_type = normalize_text(payload.get("decision_type")) or "ambiguous"
        if decision_type not in {"answer_attempt", "independent_message", "ambiguous"}:
            decision_type = "ambiguous"

        return PendingTurnDecision(
            decision_type=decision_type,  # type: ignore[arg-type]
            reply_to_user=self._to_optional_str(payload.get("reply_to_user")),
            confidence=self._to_optional_float(payload.get("confidence")),
            warnings=[str(item).strip() for item in payload.get("warnings") or [] if str(item).strip()],
        )

    @staticmethod
    def _normalize_operation_action(value: Any) -> str | None:
        normalized = normalize_text(value)
        aliases = {
            "add": "add",
            "alta": "add",
            "update": "update",
            "modify": "update",
            "remove": "remove",
            "delete": "remove",
            "clear_request": "clear_request",
            "clear": "clear_request",
            "confirm_request": "confirm_request",
            "confirm": "confirm_request",
            "show_request": "show_request",
            "show": "show_request",
        }
        return aliases.get(normalized)

    @staticmethod
    def _to_optional_str(value: Any) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @staticmethod
    def _to_optional_float(value: Any) -> float | None:
        try:
            if value is None or value == "":
                return None
            return float(value)
        except (TypeError, ValueError):
            return None

    @classmethod
    def _normalize_quantity(cls, value: Any) -> float | int | None:
        if value is None or value == "" or isinstance(value, bool):
            return None

        numeric_value = cls._to_optional_float(value)
        if numeric_value is None or numeric_value <= 0:
            return None
        return int(numeric_value) if numeric_value.is_integer() else numeric_value
