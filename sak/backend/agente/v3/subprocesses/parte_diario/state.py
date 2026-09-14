"""Estado de la conversacion: etapa, menus visibles, retorno y borrador.

etapa es el unico selector del procesador del siguiente mensaje. validacion_origen
y salida_origen conservan el lugar de retorno; no son etapas paralelas.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, get_args

from agente.v3.subprocesses.parte_diario.domain.models import ParteDiarioDraft


ParteDiarioStage = Literal[
    "inicial",
    "seleccionar_obra",
    "cargar_fecha",
    "seleccionar_fecha",
    "carga",
    "carga_aclaracion",
    "revision",
    "carga_validar_empleado",
    "carga_validar_obra",
    "carga_validar_encargado",
    "carga_validar_estado",
    "carga_validar_conflicto",
    "carga_cambiar_fecha",
    "continuar",
    "pendientes",
    "listado",
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

    # Reconstruye el contexto o la opcion desde los datos guardados.
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

    # Serializa solo los campos operativos de la conversacion.
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

    # Reconstruye el contexto o la opcion desde los datos guardados.
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

    # Serializa solo los campos operativos de la conversacion.
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
    proyecto_id: int | None = None
    nombre_proyecto: str | None = None

    # Obtiene el nombre visible de la opcion de empleado.
    @property
    def nombre_completo(self) -> str:
        return f"{self.apellido}, {self.nombre}".strip(", ")

    # Reconstruye el contexto o la opcion desde los datos guardados.
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
        proyecto_id = _parse_int(raw.get("proyecto_id"))
        nombre_proyecto = str(raw.get("nombre_proyecto") or "").strip() or None
        if opcion <= 0 or idnomina <= 0 or not (nombre or apellido):
            return None
        return cls(
            opcion=opcion,
            idnomina=idnomina,
            nombre=nombre,
            apellido=apellido,
            nro_legajo=nro_legajo,
            proyecto_id=proyecto_id,
            nombre_proyecto=nombre_proyecto,
        )

    # Serializa solo los campos operativos de la conversacion.
    def to_dict(self) -> dict[str, Any]:
        return {
            "opcion": self.opcion,
            "idnomina": self.idnomina,
            "nombre": self.nombre,
            "apellido": self.apellido,
            "nro_legajo": self.nro_legajo,
            "proyecto_id": self.proyecto_id,
            "nombre_proyecto": self.nombre_proyecto,
        }



@dataclass(slots=True)
class ParteDiarioV3State:
    etapa: ParteDiarioStage = "inicial"
    contacto_id: int | None = None
    oportunidad_id: int | None = None
    proyecto_id: int | None = None
    nombre_obra: str | None = None
    opciones_obra: list[ParteDiarioOption] = field(default_factory=list)
    opciones_fecha: list[ParteDiarioFechaOption] = field(default_factory=list)
    fecha_referida_explicita: bool = False
    texto_fecha_inicial: str | None = None
    modo_pendientes: bool = False
    modo_apertura: Literal["diario", "puntual"] = "puntual"
    asistencia_offset: int = 0
    asistencia_opciones: list[ParteDiarioAsistenciaOption] = field(default_factory=list)
    validacion_origen: str | None = None
    aclaracion_origen: str | None = None
    aclaracion_pregunta: str | None = None
    accion_cierre: str | None = None
    salida_origen: str | None = None
    fecha_siguiente: str | None = None
    historial: list[dict[str, str]] = field(default_factory=list)
    parte_state: dict[str, Any] = field(default_factory=dict)

    # Reconstruye el contexto o la opcion desde los datos guardados.
    @classmethod
    def from_dict(cls, raw: dict[str, Any] | None) -> "ParteDiarioV3State":
        data = raw or {}
        etapa = str(data.get("etapa") or "inicial")
        validacion_origen = str(data.get("validacion_origen") or "").strip() or None
        parte_state = dict(data.get("parte_state") or {})
        if etapa not in get_args(ParteDiarioStage):
            raise ValueError(f"Etapa de parte diario no admitida: {etapa}")
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
        return cls(
            etapa=etapa,  # type: ignore[arg-type]
            contacto_id=_parse_int(data.get("contacto_id")),
            oportunidad_id=_parse_int(data.get("oportunidad_id")),
            proyecto_id=_parse_int(data.get("proyecto_id")),
            nombre_obra=str(data.get("nombre_obra") or "").strip() or None,
            opciones_obra=options,
            opciones_fecha=date_options,
            fecha_referida_explicita=bool(data.get("fecha_referida_explicita")),
            texto_fecha_inicial=str(data.get("texto_fecha_inicial") or "").strip() or None,
            modo_pendientes=bool(data.get("modo_pendientes")),
            modo_apertura=data.get("modo_apertura", "puntual"),
            asistencia_offset=_parse_int(data.get("asistencia_offset")) or 0,
            asistencia_opciones=asistencia_options,
            validacion_origen=validacion_origen,
            aclaracion_origen=data.get("aclaracion_origen"),
            aclaracion_pregunta=data.get("aclaracion_pregunta"),
            accion_cierre=str(data.get("accion_cierre") or "").strip() or None,
            salida_origen=data.get("salida_origen"),
            fecha_siguiente=data.get("fecha_siguiente"),
            historial=[dict(turno) for turno in data.get("historial", [])][-12:],
            parte_state=parte_state,
        )

    # Serializa solo los campos operativos de la conversacion.
    def to_dict(self) -> dict[str, Any]:
        return {
            "etapa": self.etapa,
            "contacto_id": self.contacto_id,
            "oportunidad_id": self.oportunidad_id,
            "proyecto_id": self.proyecto_id,
            "nombre_obra": self.nombre_obra,
            "opciones_obra": [option.to_dict() for option in self.opciones_obra],
            "opciones_fecha": [option.to_dict() for option in self.opciones_fecha],
            "fecha_referida_explicita": self.fecha_referida_explicita,
            "texto_fecha_inicial": self.texto_fecha_inicial,
            "modo_pendientes": self.modo_pendientes,
            "modo_apertura": self.modo_apertura,
            "asistencia_offset": self.asistencia_offset,
            "asistencia_opciones": [option.to_dict() for option in self.asistencia_opciones],
            "validacion_origen": self.validacion_origen,
            "aclaracion_origen": self.aclaracion_origen,
            "aclaracion_pregunta": self.aclaracion_pregunta,
            "accion_cierre": self.accion_cierre,
            "salida_origen": self.salida_origen,
            "fecha_siguiente": self.fecha_siguiente,
            "historial": [dict(turno) for turno in self.historial],
            "parte_state": dict(self.parte_state),
        }

    # Conserva los ultimos doce intercambios completos, separados del borrador.
    def registrar_turno(self, mensaje: str, respuesta: str) -> None:
        self.historial = (self.historial + [{
            "usuario": mensaje,
            "asistente": respuesta,
            "etapa": self.etapa,
            "fecha_parte": str(self.parte_state.get("fecha") or ""),
        }])[-12:]

    # Indica si se completo el contexto base necesario para cargar el parte.
    def has_resolved_obra(self) -> bool:
        return self.contacto_id is not None and self.oportunidad_id is not None and self.proyecto_id is not None

    # Conserva la obra elegida y habilita la seleccion de fecha.
    def set_obra(self, option: ParteDiarioOption) -> None:
        self.contacto_id = option.contacto_id
        self.oportunidad_id = option.oportunidad_id
        self.proyecto_id = option.proyecto_id
        self.nombre_obra = option.nombre
        self.opciones_obra = []
        self.etapa = "seleccionar_fecha"

    # Reconstruye el borrador con el contacto y la obra de la conversacion.
    def draft(self) -> ParteDiarioDraft:
        draft = ParteDiarioDraft.from_dict(
            self.parte_state,
            oportunidad_id=int(self.oportunidad_id or 0),
            idproyecto=self.proyecto_id,
        )
        draft.contacto_id = self.contacto_id
        return draft

    # Conserva el borrador actualizado sin alterar la etapa conversacional.
    def set_draft(self, draft: ParteDiarioDraft) -> None:
        draft.contacto_id = self.contacto_id
        self.parte_state = draft.to_dict()


# Interpreta identificadores y offsets opcionales del contexto.
def _parse_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
