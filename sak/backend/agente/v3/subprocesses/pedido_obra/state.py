"""Estado conversacional minimo para pedidoObra v3."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal
from uuid import uuid4


PedidoObraStage = Literal["inicial", "carga", "validacion", "confirmar_salida", "cierre", "finalizado"]
ValidationType = Literal["cantidad_faltante"]


@dataclass(slots=True)
class PedidoObraItem:
    descripcion: str
    cantidad: float | None = None
    unidad: str | None = None
    item_id: str = field(default_factory=lambda: str(uuid4())[:8])

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "PedidoObraItem":
        return cls(
            item_id=str(raw.get("item_id") or str(uuid4())[:8]),
            descripcion=str(raw.get("descripcion") or "").strip(),
            cantidad=_parse_float(raw.get("cantidad")),
            unidad=str(raw.get("unidad") or "").strip() or None,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "item_id": self.item_id,
            "descripcion": self.descripcion,
            "cantidad": self.cantidad,
            "unidad": self.unidad,
        }

    def resumen(self) -> str:
        parts: list[str] = []
        if self.cantidad is not None:
            parts.append(_format_quantity(self.cantidad))
        if self.unidad:
            parts.append(self.unidad)
        parts.append(self.descripcion)
        if self.cantidad is None:
            parts.append("(sin cantidad)")
        return " ".join(parts)


@dataclass(slots=True)
class PedidoObraValidationPending:
    type: ValidationType
    item_id: str
    campo: str

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "PedidoObraValidationPending | None":
        pending_type = str(raw.get("type") or "")
        item_id = str(raw.get("item_id") or "").strip()
        campo = str(raw.get("campo") or "").strip()
        if pending_type != "cantidad_faltante" or not item_id or campo != "cantidad":
            return None
        return cls(type="cantidad_faltante", item_id=item_id, campo="cantidad")

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "item_id": self.item_id,
            "campo": self.campo,
        }


@dataclass(slots=True)
class PedidoObraOption:
    opcion: int
    nombre: str
    contacto_id: int
    oportunidad_id: int
    proyecto_id: int

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "PedidoObraOption | None":
        try:
            opcion = int(raw.get("opcion") or 0)
            contacto_id = int(raw.get("contacto_id") or 0)
            oportunidad_id = int(raw.get("oportunidad_id") or 0)
            proyecto_id = int(raw.get("proyecto_id") or 0)
        except (TypeError, ValueError):
            return None
        nombre = str(raw.get("nombre") or "").strip()
        if opcion <= 0 or not nombre or contacto_id <= 0 or oportunidad_id <= 0 or proyecto_id <= 0:
            return None
        return cls(
            opcion=opcion,
            nombre=nombre,
            contacto_id=contacto_id,
            oportunidad_id=oportunidad_id,
            proyecto_id=proyecto_id,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "opcion": self.opcion,
            "nombre": self.nombre,
            "contacto_id": self.contacto_id,
            "oportunidad_id": self.oportunidad_id,
            "proyecto_id": self.proyecto_id,
        }


@dataclass(slots=True)
class PedidoObraState:
    etapa: PedidoObraStage = "inicial"
    contacto_id: int | None = None
    oportunidad_id: int | None = None
    proyecto_id: int | None = None
    opciones_obra: list[PedidoObraOption] = field(default_factory=list)
    items: list[PedidoObraItem] = field(default_factory=list)
    pendiente_item_id: str | None = None
    pendientes_validacion: list[PedidoObraValidationPending] = field(default_factory=list)

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> "PedidoObraState":
        data = raw or {}
        etapa = str(data.get("etapa") or "inicial")
        if etapa not in {"inicial", "carga", "validacion", "confirmar_salida", "cierre", "finalizado"}:
            etapa = "inicial"
        pendientes: list[PedidoObraValidationPending] = []
        for pending in data.get("pendientes_validacion", []):
            if isinstance(pending, dict):
                parsed = PedidoObraValidationPending.from_dict(pending)
                if parsed is not None:
                    pendientes.append(parsed)
        opciones_obra: list[PedidoObraOption] = []
        for option in data.get("opciones_obra", []):
            if isinstance(option, dict):
                parsed = PedidoObraOption.from_dict(option)
                if parsed is not None:
                    opciones_obra.append(parsed)
        return cls(
            etapa=etapa,  # type: ignore[arg-type]
            contacto_id=_parse_int(data.get("contacto_id")),
            oportunidad_id=_parse_int(data.get("oportunidad_id")),
            proyecto_id=_parse_int(data.get("proyecto_id")),
            opciones_obra=opciones_obra,
            items=[
                PedidoObraItem.from_dict(item)
                for item in data.get("items", [])
                if isinstance(item, dict) and str(item.get("descripcion") or "").strip()
            ],
            pendiente_item_id=str(data.get("pendiente_item_id") or "").strip() or None,
            pendientes_validacion=pendientes,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "etapa": self.etapa,
            "contacto_id": self.contacto_id,
            "oportunidad_id": self.oportunidad_id,
            "proyecto_id": self.proyecto_id,
            "opciones_obra": [option.to_dict() for option in self.opciones_obra],
            "items": [item.to_dict() for item in self.items],
            "pendiente_item_id": self.pendiente_item_id,
            "pendientes_validacion": [pending.to_dict() for pending in self.pendientes_validacion],
        }

    def has_resolved_obra(self) -> bool:
        return self.contacto_id is not None and self.oportunidad_id is not None and self.proyecto_id is not None

    def set_obra(self, option: PedidoObraOption) -> None:
        self.contacto_id = option.contacto_id
        self.oportunidad_id = option.oportunidad_id
        self.proyecto_id = option.proyecto_id
        self.opciones_obra = []
        self.etapa = "carga"

    def resumen_items(self) -> str:
        if not self.items:
            return "(sin materiales cargados)"
        return "\n".join(f"- {item.resumen()}" for item in self.items)

    def first_missing_required(self) -> PedidoObraItem | None:
        for item in self.items:
            if item.cantidad is None:
                return item
        return None

    def rebuild_validation_pendings(self) -> None:
        self.pendientes_validacion = [
            PedidoObraValidationPending(type="cantidad_faltante", item_id=item.item_id, campo="cantidad")
            for item in self.items
            if item.cantidad is None
        ]
        self.pendiente_item_id = self.pendientes_validacion[0].item_id if self.pendientes_validacion else None

    def current_validation_pending(self) -> PedidoObraValidationPending | None:
        if not self.pendientes_validacion:
            self.pendiente_item_id = None
            return None
        current = self.pendientes_validacion[0]
        self.pendiente_item_id = current.item_id
        return current

    def complete_current_validation(self) -> None:
        if self.pendientes_validacion:
            self.pendientes_validacion.pop(0)
        self.pendiente_item_id = self.pendientes_validacion[0].item_id if self.pendientes_validacion else None

    def find_item(self, item_id: str | None) -> PedidoObraItem | None:
        if not item_id:
            return None
        for item in self.items:
            if item.item_id == item_id:
                return item
        return None


def _parse_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _format_quantity(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.2f}".rstrip("0").rstrip(".")
