"""Modelos del proceso pedido_obra.

El LLM interpreta el turno y devuelve operaciones estructuradas. El backend
mantiene el estado y aplica esas operaciones de forma deterministica.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal


def _format_quantity(value: float | int | None) -> str:
    if value is None:
        return ""
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return str(value)
    if numeric.is_integer():
        return str(int(numeric))
    return f"{numeric:.2f}".rstrip("0").rstrip(".")


def _parse_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


@dataclass(slots=True)
class PedidoItem:
    descripcion: str
    cantidad: float | None = None
    unidad: str | None = None
    item_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])

    def to_dict(self) -> dict[str, Any]:
        return {
            "item_id": self.item_id,
            "descripcion": self.descripcion,
            "cantidad": self.cantidad,
            "unidad": self.unidad,
        }

    def to_prompt_dict(self) -> dict[str, Any]:
        return {
            "id": self.item_id,
            "descripcion": self.descripcion,
            "cantidad": self.cantidad,
            "unidad": self.unidad,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "PedidoItem":
        return cls(
            item_id=str(d.get("item_id") or d.get("id") or str(uuid.uuid4())[:8]),
            descripcion=str(d.get("descripcion") or "").strip(),
            cantidad=_parse_float(d.get("cantidad")),
            unidad=str(d.get("unidad") or "").strip() or None,
        )

    def resumen(self) -> str:
        descripcion = self.descripcion.strip()
        if self.cantidad is None:
            return f"{descripcion} (sin cantidad)"
        parts = [_format_quantity(self.cantidad)]
        if self.unidad:
            parts.append(self.unidad.strip())
        parts.append(descripcion)
        return " ".join(part for part in parts if part).strip()


Etapa = Literal["inicial", "carga", "confirmacion", "finalizado"]
Esperando = Literal[
    "decision_pedido_previo",
    "confirmacion_cierre",
    "cantidad_faltante",
]


@dataclass
class PedidoState:
    oportunidad_id: int
    etapa: Etapa = "inicial"
    items: list[PedidoItem] = field(default_factory=list)
    esperando: Esperando | None = None

    # Campos conservados para compatibilidad con estados JSON previos.
    comando_pendiente: dict[str, Any] | None = None
    item_cantidad_idx: int | None = None

    updated_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "oportunidad_id": self.oportunidad_id,
            "etapa": self.etapa,
            "items": [item.to_dict() for item in self.items],
            "esperando": self.esperando,
            "comando_pendiente": self.comando_pendiente,
            "item_cantidad_idx": self.item_cantidad_idx,
            "updated_at": self.updated_at,
        }

    def to_prompt_dict(self) -> dict[str, Any]:
        pending_item = None
        if self.esperando == "cantidad_faltante" and self.item_cantidad_idx is not None:
            if 0 <= self.item_cantidad_idx < len(self.items):
                pending_item = self.items[self.item_cantidad_idx].to_prompt_dict()

        return {
            "etapa": self.etapa,
            "esperando": self.esperando,
            "items": [item.to_prompt_dict() for item in self.items],
            "pending_item": pending_item,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any] | None, oportunidad_id: int | None = None) -> "PedidoState":
        raw = d or {}
        oid = oportunidad_id if oportunidad_id is not None else int(raw.get("oportunidad_id") or 0)
        etapa = str(raw.get("etapa") or "inicial")
        if etapa not in {"inicial", "carga", "confirmacion", "finalizado"}:
            etapa = "inicial"

        esperando = raw.get("esperando")
        if esperando not in {"decision_pedido_previo", "confirmacion_cierre", "cantidad_faltante"}:
            esperando = None

        return cls(
            oportunidad_id=oid,
            etapa=etapa,  # type: ignore[arg-type]
            items=[PedidoItem.from_dict(item) for item in (raw.get("items") or []) if isinstance(item, dict)],
            esperando=esperando,  # type: ignore[arg-type]
            comando_pendiente=raw.get("comando_pendiente") if isinstance(raw.get("comando_pendiente"), dict) else None,
            item_cantidad_idx=raw.get("item_cantidad_idx"),
            updated_at=raw.get("updated_at") or datetime.now(UTC).isoformat(),
        )

    @classmethod
    def empty(cls, oportunidad_id: int = 0) -> "PedidoState":
        return cls(oportunidad_id=oportunidad_id)

    def copy(self) -> "PedidoState":
        return PedidoState.from_dict(self.to_dict(), oportunidad_id=self.oportunidad_id)

    def touch(self) -> None:
        self.updated_at = datetime.now(UTC).isoformat()

    def items_sin_cantidad(self) -> list[PedidoItem]:
        return [item for item in self.items if item.cantidad is None]

    def resumen_items(self) -> str:
        if not self.items:
            return "(lista vacia)"
        return "\n".join(f"  - {item.resumen()}" for item in self.items)

    def tiene_pedido_activo(self) -> bool:
        return bool(self.items) and self.etapa in {"carga", "confirmacion"}


OperationType = Literal[
    "add_items",
    "update_item",
    "remove_item",
    "clear_order",
    "show_order",
    "finish_order",
    "confirm_order",
    "cancel_order",
    "continue_previous",
    "start_new_order",
    "answer_missing_quantity",
    "offtopic",
]


@dataclass(slots=True)
class OperationItem:
    descripcion: str
    cantidad: float | None = None
    unidad: str | None = None


@dataclass(slots=True)
class PedidoOperation:
    type: str
    items: list[OperationItem] = field(default_factory=list)
    target_item_id: str | None = None
    target_descripcion: str | None = None
    nueva_descripcion: str | None = None
    cantidad: float | None = None
    unidad: str | None = None
    reply: str | None = None


@dataclass(slots=True)
class TurnPlan:
    operations: list[PedidoOperation] = field(default_factory=list)
    reply: str | None = None
    raw_response: dict[str, Any] | None = None
    llm_ms: int | None = None


@dataclass(slots=True)
class ExecutionResult:
    status: str
    next_state: PedidoState
    reply: str
    keep_active: bool = True
    pedido_listo: bool = False
    used_llm: bool = True
    applied_operations: list[str] = field(default_factory=list)


@dataclass
class NodeResult:
    """Contrato historico que consume el orquestador."""

    reply: str | None
    next_state: PedidoState
    keep_active: bool = True
    used_llm: bool = False
    _redirect: str | None = None
    pedido_listo: bool = False
