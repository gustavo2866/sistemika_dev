"""Estado wrapper de parteDiario para agente v3."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from agente.v3.subprocesses.parte_diario.models import ParteDiarioState as ParteDiarioDraftState


ParteDiarioStage = Literal[
    "inicial",
    "cargar_fecha",
    "seleccionar_fecha",
    "carga",
    "validacion",
    "cierre",
    "confirmar_salida",
    "finalizado",
]


@dataclass(slots=True)
class ParteDiarioOption:
    opcion: int
    nombre: str
    contacto_id: int
    oportunidad_id: int
    proyecto_id: int

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "ParteDiarioOption | None":
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
class ParteDiarioFechaOption:
    opcion: int
    fecha: str
    estado: str
    parte_id: int | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "ParteDiarioFechaOption | None":
        try:
            opcion = int(raw.get("opcion") or 0)
        except (TypeError, ValueError):
            return None
        fecha = str(raw.get("fecha") or "").strip()
        estado = str(raw.get("estado") or "").strip()
        parte_id = _parse_int(raw.get("parte_id"))
        if opcion <= 0 or not fecha or not estado:
            return None
        return cls(opcion=opcion, fecha=fecha, estado=estado, parte_id=parte_id)

    def to_dict(self) -> dict[str, Any]:
        return {
            "opcion": self.opcion,
            "fecha": self.fecha,
            "estado": self.estado,
            "parte_id": self.parte_id,
        }


@dataclass(slots=True)
class ParteDiarioV3State:
    etapa: ParteDiarioStage = "inicial"
    contacto_id: int | None = None
    oportunidad_id: int | None = None
    proyecto_id: int | None = None
    opciones_obra: list[ParteDiarioOption] = field(default_factory=list)
    opciones_fecha: list[ParteDiarioFechaOption] = field(default_factory=list)
    fecha_menu_pendiente: bool = False
    parte_state: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> "ParteDiarioV3State":
        data = raw or {}
        etapa = str(data.get("etapa") or "inicial")
        if etapa not in {
            "inicial",
            "cargar_fecha",
            "seleccionar_fecha",
            "carga",
            "validacion",
            "cierre",
            "confirmar_salida",
            "finalizado",
        }:
            etapa = "inicial"
        options: list[ParteDiarioOption] = []
        for option in data.get("opciones_obra", []):
            if isinstance(option, dict):
                parsed = ParteDiarioOption.from_dict(option)
                if parsed is not None:
                    options.append(parsed)
        date_options: list[ParteDiarioFechaOption] = []
        for option in data.get("opciones_fecha", []):
            if isinstance(option, dict):
                parsed = ParteDiarioFechaOption.from_dict(option)
                if parsed is not None:
                    date_options.append(parsed)
        return cls(
            etapa=etapa,  # type: ignore[arg-type]
            contacto_id=_parse_int(data.get("contacto_id")),
            oportunidad_id=_parse_int(data.get("oportunidad_id")),
            proyecto_id=_parse_int(data.get("proyecto_id")),
            opciones_obra=options,
            opciones_fecha=date_options,
            fecha_menu_pendiente=bool(data.get("fecha_menu_pendiente")),
            parte_state=dict(data.get("parte_state") or {}),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "etapa": self.etapa,
            "contacto_id": self.contacto_id,
            "oportunidad_id": self.oportunidad_id,
            "proyecto_id": self.proyecto_id,
            "opciones_obra": [option.to_dict() for option in self.opciones_obra],
            "opciones_fecha": [option.to_dict() for option in self.opciones_fecha],
            "fecha_menu_pendiente": self.fecha_menu_pendiente,
            "parte_state": dict(self.parte_state),
        }

    def has_resolved_obra(self) -> bool:
        return self.contacto_id is not None and self.oportunidad_id is not None and self.proyecto_id is not None

    def set_obra(self, option: ParteDiarioOption) -> None:
        self.contacto_id = option.contacto_id
        self.oportunidad_id = option.oportunidad_id
        self.proyecto_id = option.proyecto_id
        self.opciones_obra = []
        self.etapa = "cargar_fecha"

    def draft(self) -> ParteDiarioDraftState:
        return ParteDiarioDraftState.from_dict(
            self.parte_state,
            oportunidad_id=int(self.oportunidad_id or 0),
            idproyecto=self.proyecto_id,
        )

    def set_draft(self, draft: ParteDiarioDraftState) -> None:
        self.parte_state = draft.to_dict()


def _parse_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
