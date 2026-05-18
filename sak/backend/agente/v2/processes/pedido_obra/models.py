"""Modelos de estado del proceso pedido_obra."""

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


# ---------------------------------------------------------------------------
# Item del pedido
# ---------------------------------------------------------------------------

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

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "PedidoItem":
        return cls(
            item_id=d.get("item_id") or str(uuid.uuid4())[:8],
            descripcion=str(d.get("descripcion") or ""),
            cantidad=d.get("cantidad"),
            unidad=d.get("unidad"),
        )

    def resumen(self) -> str:
        descripcion = self.descripcion.strip()
        if self.cantidad is None:
            return f"{descripcion} (sin cantidad)"
        cantidad = _format_quantity(self.cantidad)
        parts = [cantidad]
        if self.unidad:
            parts.append(self.unidad.strip())
        parts.append(descripcion)
        return " ".join(part for part in parts if part).strip()


# ---------------------------------------------------------------------------
# Estado del pedido (el "grafo" serializado)
# ---------------------------------------------------------------------------

Etapa = Literal["inicial", "carga", "confirmacion", "finalizado"]

Esperando = Literal[
    "decision_pedido_previo",   # "¿continuás o nuevo pedido?"
    "confirmacion_comando",     # "¿confirmás quitar X?"
    "confirmacion_cierre",      # "¿confirmás el pedido?"
    "cantidad_faltante",        # pidiendo cantidad de un ítem sin cantidad
    "inicio_pedido",            # "¿querés iniciar un pedido?"
]


@dataclass
class PedidoState:
    """Estado unificado del proceso pedido_obra — un objeto por conversación."""

    oportunidad_id: int
    etapa: Etapa = "inicial"
    items: list[PedidoItem] = field(default_factory=list)

    # Qué estamos esperando del usuario en este momento
    esperando: Esperando | None = None

    # Comando que espera confirmación antes de ejecutarse
    comando_pendiente: dict[str, Any] | None = None

    # Para confirmacion: índice del ítem al que estamos pidiendo cantidad
    item_cantidad_idx: int | None = None

    # Timestamps
    updated_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    # -----------------------------------------------------------------------
    # Serialización — compatible con process_state del ConversationState
    # -----------------------------------------------------------------------

    def to_dict(self) -> dict[str, Any]:
        return {
            "oportunidad_id": self.oportunidad_id,
            "etapa": self.etapa,
            "items": [i.to_dict() for i in self.items],
            "esperando": self.esperando,
            "comando_pendiente": self.comando_pendiente,
            "item_cantidad_idx": self.item_cantidad_idx,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any], oportunidad_id: int | None = None) -> "PedidoState":
        oid = oportunidad_id if oportunidad_id is not None else int(d.get("oportunidad_id") or 0)
        return cls(
            oportunidad_id=oid,
            etapa=d.get("etapa") or "inicial",
            items=[PedidoItem.from_dict(i) for i in (d.get("items") or [])],
            esperando=d.get("esperando"),
            comando_pendiente=d.get("comando_pendiente"),
            item_cantidad_idx=d.get("item_cantidad_idx"),
            updated_at=d.get("updated_at") or datetime.now(UTC).isoformat(),
        )

    @classmethod
    def empty(cls, oportunidad_id: int = 0) -> "PedidoState":
        return cls(oportunidad_id=oportunidad_id)

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------

    def touch(self) -> None:
        self.updated_at = datetime.now(UTC).isoformat()

    def items_sin_cantidad(self) -> list[PedidoItem]:
        return [i for i in self.items if i.cantidad is None]

    def resumen_items(self) -> str:
        if not self.items:
            return "(lista vacía)"
        lines = [f"  - {i.resumen()}" for i in self.items]
        return "\n".join(lines)

    def tiene_pedido_activo(self) -> bool:
        return bool(self.items) and self.etapa in ("carga", "confirmacion")


# ---------------------------------------------------------------------------
# Resultado de un nodo
# ---------------------------------------------------------------------------

@dataclass
class NodeResult:
    """Lo que devuelve cada nodo al dispatcher."""

    reply: str | None                   # None cuando _redirect está activo
    next_state: PedidoState             # estado actualizado
    keep_active: bool = True            # False solo en etapa finalizado o cancel
    used_llm: bool = False              # para _timing / observabilidad
    _redirect: str | None = None        # "carga" → handler re-despacha al nodo carga
    pedido_listo: bool = False          # True cuando el pedido fue confirmado
