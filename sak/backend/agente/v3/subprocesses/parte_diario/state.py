"""Estado wrapper de parteDiario para agente v3."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from agente.v3.subprocesses.parte_diario.models import ParteDiarioState as ParteDiarioDraftState


ParteDiarioStage = Literal[
    "inicial",
    "seleccionar_obra",
    "cargar_fecha",
    "seleccionar_fecha",
    "carga",
    "revision",
    "validacion",
    "cierre",
    "continuar",
    "pendientes",
    "novedades",
    "confirmar_salida",
    "menu",
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
class ParteDiarioAsistenciaOption:
    opcion: int
    idnomina: int
    nombre: str
    apellido: str
    nro_legajo: str | None = None

    @property
    def nombre_completo(self) -> str:
        return f"{self.apellido}, {self.nombre}".strip(", ")

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "ParteDiarioAsistenciaOption | None":
        try:
            opcion = int(raw.get("opcion") or 0)
            idnomina = int(raw.get("idnomina") or 0)
        except (TypeError, ValueError):
            return None
        nombre = str(raw.get("nombre") or "").strip()
        apellido = str(raw.get("apellido") or "").strip()
        nro_legajo = str(raw.get("nro_legajo") or "").strip() or None
        if opcion <= 0 or idnomina <= 0 or not (nombre or apellido):
            return None
        return cls(opcion=opcion, idnomina=idnomina, nombre=nombre, apellido=apellido, nro_legajo=nro_legajo)

    def to_dict(self) -> dict[str, Any]:
        return {
            "opcion": self.opcion,
            "idnomina": self.idnomina,
            "nombre": self.nombre,
            "apellido": self.apellido,
            "nro_legajo": self.nro_legajo,
        }


@dataclass(slots=True)
class ParteDiarioAsistenciaRegistro:
    nombre: str
    estado_codigo: str
    motivo: str

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "ParteDiarioAsistenciaRegistro | None":
        nombre = str(raw.get("nombre") or "").strip()
        estado_codigo = str(raw.get("estado_codigo") or "").strip().upper()
        motivo = str(raw.get("motivo") or "").strip()
        if not nombre or not estado_codigo or not motivo:
            return None
        return cls(nombre=nombre, estado_codigo=estado_codigo, motivo=motivo)

    def to_dict(self) -> dict[str, Any]:
        return {"nombre": self.nombre, "estado_codigo": self.estado_codigo, "motivo": self.motivo}


@dataclass(slots=True)
class ParteDiarioV3State:
    etapa: ParteDiarioStage = "inicial"
    contacto_id: int | None = None
    oportunidad_id: int | None = None
    proyecto_id: int | None = None
    nombre_obra: str | None = None
    opciones_obra: list[ParteDiarioOption] = field(default_factory=list)
    opciones_fecha: list[ParteDiarioFechaOption] = field(default_factory=list)
    fecha_menu_pendiente: bool = False
    fecha_referida_explicita: bool = False
    fecha_objetivo: str | None = None
    dia_semana_objetivo: int | None = None
    texto_fecha_inicial: str | None = None
    modo_pendientes: bool = False
    asistencia_offset: int = 0
    asistencia_opciones: list[ParteDiarioAsistenciaOption] = field(default_factory=list)
    asistencia_registros: list[ParteDiarioAsistenciaRegistro] = field(default_factory=list)
    asistencia_reemplazo_pendiente: dict[str, Any] = field(default_factory=dict)
    parte_state: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> "ParteDiarioV3State":
        data = raw or {}
        etapa = str(data.get("etapa") or "inicial")
        if etapa not in {
            "inicial",
            "seleccionar_obra",
            "cargar_fecha",
            "seleccionar_fecha",
            "carga",
            "revision",
            "validacion",
            "cierre",
            "continuar",
            "pendientes",
            "novedades",
            "confirmar_salida",
            "menu",
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
        asistencia_options: list[ParteDiarioAsistenciaOption] = []
        for option in data.get("asistencia_opciones", []):
            if isinstance(option, dict):
                parsed = ParteDiarioAsistenciaOption.from_dict(option)
                if parsed is not None:
                    asistencia_options.append(parsed)
        asistencia_registros: list[ParteDiarioAsistenciaRegistro] = []
        for item in data.get("asistencia_registros", []):
            if isinstance(item, dict):
                parsed = ParteDiarioAsistenciaRegistro.from_dict(item)
                if parsed is not None:
                    asistencia_registros.append(parsed)
        return cls(
            etapa=etapa,  # type: ignore[arg-type]
            contacto_id=_parse_int(data.get("contacto_id")),
            oportunidad_id=_parse_int(data.get("oportunidad_id")),
            proyecto_id=_parse_int(data.get("proyecto_id")),
            nombre_obra=str(data.get("nombre_obra") or "").strip() or None,
            opciones_obra=options,
            opciones_fecha=date_options,
            fecha_menu_pendiente=bool(data.get("fecha_menu_pendiente")),
            fecha_referida_explicita=bool(data.get("fecha_referida_explicita")),
            fecha_objetivo=str(data.get("fecha_objetivo") or "").strip() or None,
            dia_semana_objetivo=_parse_int(data.get("dia_semana_objetivo")),
            texto_fecha_inicial=str(data.get("texto_fecha_inicial") or "").strip() or None,
            modo_pendientes=bool(data.get("modo_pendientes")),
            asistencia_offset=_parse_int(data.get("asistencia_offset")) or 0,
            asistencia_opciones=asistencia_options,
            asistencia_registros=asistencia_registros,
            asistencia_reemplazo_pendiente=dict(data.get("asistencia_reemplazo_pendiente") or {}),
            parte_state=dict(data.get("parte_state") or {}),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "etapa": self.etapa,
            "contacto_id": self.contacto_id,
            "oportunidad_id": self.oportunidad_id,
            "proyecto_id": self.proyecto_id,
            "nombre_obra": self.nombre_obra,
            "opciones_obra": [option.to_dict() for option in self.opciones_obra],
            "opciones_fecha": [option.to_dict() for option in self.opciones_fecha],
            "fecha_menu_pendiente": self.fecha_menu_pendiente,
            "fecha_referida_explicita": self.fecha_referida_explicita,
            "fecha_objetivo": self.fecha_objetivo,
            "dia_semana_objetivo": self.dia_semana_objetivo,
            "texto_fecha_inicial": self.texto_fecha_inicial,
            "modo_pendientes": self.modo_pendientes,
            "asistencia_offset": self.asistencia_offset,
            "asistencia_opciones": [option.to_dict() for option in self.asistencia_opciones],
            "asistencia_registros": [item.to_dict() for item in self.asistencia_registros],
            "asistencia_reemplazo_pendiente": dict(self.asistencia_reemplazo_pendiente),
            "parte_state": dict(self.parte_state),
        }

    def has_resolved_obra(self) -> bool:
        return self.contacto_id is not None and self.oportunidad_id is not None and self.proyecto_id is not None

    def set_obra(self, option: ParteDiarioOption) -> None:
        self.contacto_id = option.contacto_id
        self.oportunidad_id = option.oportunidad_id
        self.proyecto_id = option.proyecto_id
        self.nombre_obra = option.nombre
        self.opciones_obra = []
        self.etapa = "seleccionar_fecha"

    def draft(self) -> ParteDiarioDraftState:
        draft = ParteDiarioDraftState.from_dict(
            self.parte_state,
            oportunidad_id=int(self.oportunidad_id or 0),
            idproyecto=self.proyecto_id,
        )
        draft.contacto_id = self.contacto_id
        return draft

    def set_draft(self, draft: ParteDiarioDraftState) -> None:
        draft.contacto_id = self.contacto_id
        self.parte_state = draft.to_dict()


def _parse_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
