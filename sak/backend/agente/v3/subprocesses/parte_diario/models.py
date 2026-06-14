"""Modelos serializables del proceso parte_diario."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


def _float_or_none(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


@dataclass(slots=True)
class EstadoItem:
    id: int
    abreviatura: str
    nombre: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class NominaItem:
    idnomina: int
    nombre: str
    apellido: str
    idproyecto: int | None = None
    nombre_proyecto: str | None = None
    fuera_de_proyecto: bool = False
    nro_legajo: str | None = None

    @property
    def nombre_completo(self) -> str:
        return f"{self.apellido}, {self.nombre}".strip(", ")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "NominaItem":
        return cls(
            idnomina=int(raw["idnomina"]),
            nombre=str(raw.get("nombre") or ""),
            apellido=str(raw.get("apellido") or ""),
            idproyecto=raw.get("idproyecto"),
            nombre_proyecto=raw.get("nombre_proyecto"),
            fuera_de_proyecto=bool(raw.get("fuera_de_proyecto")),
            nro_legajo=raw.get("nro_legajo"),
        )


@dataclass(slots=True)
class NovedadPersonal:
    nombre: str
    idnomina: int | None = None
    idestado: int | None = None
    estado_codigo: str | None = None
    horas: float | None = None
    ingreso: str | None = None
    egreso: str | None = None
    descripcion: str | None = None
    fuera_de_proyecto: bool = False
    nombre_proyecto: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "NovedadPersonal":
        return cls(
            nombre=str(raw.get("nombre") or ""),
            idnomina=raw.get("idnomina"),
            idestado=raw.get("idestado"),
            estado_codigo=str(raw.get("estado_codigo") or "").upper() or None,
            horas=_float_or_none(raw.get("horas")),
            ingreso=raw.get("ingreso"),
            egreso=raw.get("egreso"),
            descripcion=raw.get("descripcion"),
            fuera_de_proyecto=bool(raw.get("fuera_de_proyecto")),
            nombre_proyecto=raw.get("nombre_proyecto"),
        )


@dataclass(slots=True)
class PendienteAmbiguo:
    nombre: str
    idestado: int | None = None
    estado_codigo: str | None = None
    horas: float | None = None
    horas_extra: float | None = None
    descripcion: str | None = None
    candidatos: list[NominaItem] | None = None
    nombre_no_encontrado: bool = False
    idnomina_resuelto: int | None = None
    fuera_de_proyecto: bool = False
    nombre_proyecto: str | None = None
    intentos_estado: int = 0

    @property
    def nombre_pendiente(self) -> bool:
        return (self.nombre_no_encontrado or bool(self.candidatos)) and self.idnomina_resuelto is None

    @property
    def estado_pendiente(self) -> bool:
        return self.idestado is None and not self.fuera_de_proyecto

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["candidatos"] = [item.to_dict() for item in self.candidatos] if self.candidatos else None
        return payload

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "PendienteAmbiguo":
        candidates = raw.get("candidatos")
        return cls(
            nombre=str(raw.get("nombre") or ""),
            idestado=raw.get("idestado"),
            estado_codigo=str(raw.get("estado_codigo") or "").upper() or None,
            horas=_float_or_none(raw.get("horas")),
            horas_extra=_float_or_none(raw.get("horas_extra")),
            descripcion=raw.get("descripcion"),
            candidatos=[NominaItem.from_dict(item) for item in candidates] if isinstance(candidates, list) else None,
            nombre_no_encontrado=bool(raw.get("nombre_no_encontrado")),
            idnomina_resuelto=raw.get("idnomina_resuelto"),
            fuera_de_proyecto=bool(raw.get("fuera_de_proyecto")),
            nombre_proyecto=raw.get("nombre_proyecto"),
            intentos_estado=int(raw.get("intentos_estado") or 0),
        )


@dataclass(slots=True)
class ConflictoNovedad:
    idnomina: int
    nombre: str
    opciones: list[NovedadPersonal]

    def to_dict(self) -> dict[str, Any]:
        return {
            "idnomina": self.idnomina,
            "nombre": self.nombre,
            "opciones": [item.to_dict() for item in self.opciones],
        }

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "ConflictoNovedad":
        return cls(
            idnomina=int(raw["idnomina"]),
            nombre=str(raw.get("nombre") or ""),
            opciones=[NovedadPersonal.from_dict(item) for item in raw.get("opciones") or []],
        )


@dataclass
class ParteDiarioState:
    oportunidad_id: int
    idproyecto: int | None = None
    fecha: str | None = None
    parte_id: int | None = None
    novedades: list[NovedadPersonal] = field(default_factory=list)
    sin_novedades_informado: bool = False
    pendientes_ambiguos: list[PendienteAmbiguo] = field(default_factory=list)
    conflictos_novedad: list[ConflictoNovedad] = field(default_factory=list)
    esperando: str | None = None
    fecha_propuesta: str | None = None
    retomado: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "oportunidad_id": self.oportunidad_id,
            "idproyecto": self.idproyecto,
            "fecha": self.fecha,
            "parte_id": self.parte_id,
            "novedades": [item.to_dict() for item in self.novedades],
            "sin_novedades_informado": self.sin_novedades_informado,
            "pendientes_ambiguos": [item.to_dict() for item in self.pendientes_ambiguos],
            "conflictos_novedad": [item.to_dict() for item in self.conflictos_novedad],
            "esperando": self.esperando,
            "fecha_propuesta": self.fecha_propuesta,
            "retomado": self.retomado,
        }

    @classmethod
    def from_dict(
        cls,
        raw: dict[str, Any] | None,
        *,
        oportunidad_id: int,
        idproyecto: int | None = None,
    ) -> "ParteDiarioState":
        data = raw or {}
        return cls(
            oportunidad_id=oportunidad_id,
            idproyecto=data.get("idproyecto") or idproyecto,
            fecha=data.get("fecha"),
            parte_id=data.get("parte_id"),
            novedades=[NovedadPersonal.from_dict(item) for item in data.get("novedades") or []],
            sin_novedades_informado=bool(data.get("sin_novedades_informado")),
            pendientes_ambiguos=[
                PendienteAmbiguo.from_dict(item) for item in data.get("pendientes_ambiguos") or []
            ],
            conflictos_novedad=[
                ConflictoNovedad.from_dict(item) for item in data.get("conflictos_novedad") or []
            ],
            esperando=data.get("esperando"),
            fecha_propuesta=data.get("fecha_propuesta"),
            retomado=bool(data.get("retomado")),
        )

    def copy(self) -> "ParteDiarioState":
        return self.from_dict(self.to_dict(), oportunidad_id=self.oportunidad_id, idproyecto=self.idproyecto)


@dataclass(slots=True)
class ParteDiarioOperation:
    type: str
    nombre: str | None = None
    estado_codigo: str | None = None
    horas: float | None = None
    horas_extra: float | None = None
    descripcion: str | None = None
    fecha: str | None = None
    requested: str | None = None
    reply: str | None = None


@dataclass(slots=True)
class TurnPlan:
    operations: list[ParteDiarioOperation] = field(default_factory=list)
    reply: str | None = None
    raw_response: dict[str, Any] | None = None
    llm_ms: int | None = None

    def has_type(self, operation_type: str) -> bool:
        return any(operation.type == operation_type for operation in self.operations)

    def is_readonly(self) -> bool:
        effective_operations = [
            operation
            for operation in self.operations
            if operation.type != "set_fecha"
        ]
        return bool(effective_operations) and all(
            operation.type in {"mostrar_parte", "mostrar_nomina", "offtopic"}
            for operation in effective_operations
        )


@dataclass(slots=True)
class ExecutionResult:
    status: str
    next_state: ParteDiarioState
    reply: str
    keep_active: bool = True
    parte_listo: bool = False
    cerrar_parte: bool = False
    cancelado: bool = False
    errors: list[str] = field(default_factory=list)
    applied_operations: list[str] = field(default_factory=list)
