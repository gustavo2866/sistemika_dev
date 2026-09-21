"""Datos serializables del dominio, compartidos por sus entidades.

No contienen la etapa conversacional ni contratos del interprete. El borrador
ParteDiarioDraft se distingue de ParteDiarioV3State, definido en state.py.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


# Convierte horas opcionales sin confundir ausencia de dato con cero.
def _float_or_none(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# region Datos del dominio

# Identifica una obra candidata como destino de trabajo.
@dataclass(slots=True)
class DestinoProyectoOption:
    opcion: int
    proyecto_id: int
    nombre: str

    # Serializa los datos para conservarlos en el borrador.
    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    # Reconstruye los datos desde su representacion serializada.
    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "DestinoProyectoOption | None":
        try:
            opcion = int(raw.get("opcion") or 0)
            proyecto_id = int(raw.get("proyecto_id") or 0)
        except (TypeError, ValueError):
            return None
        nombre = str(raw.get("nombre") or "").strip()
        if opcion <= 0 or proyecto_id <= 0 or not nombre:
            return None
        return cls(opcion=opcion, proyecto_id=proyecto_id, nombre=nombre)


# Identifica un encargado candidato de la obra destino.
@dataclass(slots=True)
class DestinoEncargadoOption:
    opcion: int
    contacto_id: int
    nombre: str

    # Serializa los datos para conservarlos en el borrador.
    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    # Reconstruye los datos desde su representacion serializada.
    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "DestinoEncargadoOption | None":
        try:
            opcion = int(raw.get("opcion") or 0)
            contacto_id = int(raw.get("contacto_id") or 0)
        except (TypeError, ValueError):
            return None
        nombre = str(raw.get("nombre") or "").strip()
        if opcion <= 0 or contacto_id <= 0 or not nombre:
            return None
        return cls(opcion=opcion, contacto_id=contacto_id, nombre=nombre)


# Representa un motivo del catalogo de novedades.
@dataclass(slots=True)
class EstadoItem:
    id: int
    abreviatura: str
    nombre: str

    # Serializa los datos para conservarlos en el borrador.
    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# Representa un empleado y su asignacion de referencia.
@dataclass(slots=True)
class NominaItem:
    idnomina: int
    nombre: str
    apellido: str
    idproyecto: int | None = None
    nombre_proyecto: str | None = None
    fuera_de_proyecto: bool = False
    nro_legajo: str | None = None
    encargado_contacto_id: int | None = None
    encargado_nombre: str | None = None

    # Forma el nombre visible del empleado, con apellido primero.
    @property
    def nombre_completo(self) -> str:
        return f"{self.apellido}, {self.nombre}".strip(", ")

    # Serializa los datos para conservarlos en el borrador.
    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    # Reconstruye los datos desde su representacion serializada.
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
            encargado_contacto_id=raw.get("encargado_contacto_id"),
            encargado_nombre=raw.get("encargado_nombre"),
        )


# Conserva los datos de una novedad resuelta.
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
    idproyecto_destino: int | None = None
    contacto_id_destino: int | None = None
    nombre_encargado_destino: str | None = None
    validar_destino_trabajo: bool = False
    nro_legajo: str | None = None

    # Serializa los datos para conservarlos en el borrador.
    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    # Reconstruye los datos desde su representacion serializada.
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
            idproyecto_destino=raw.get("idproyecto_destino"),
            contacto_id_destino=raw.get("contacto_id_destino"),
            nombre_encargado_destino=raw.get("nombre_encargado_destino"),
            validar_destino_trabajo=bool(raw.get("validar_destino_trabajo")),
            nro_legajo=raw.get("nro_legajo"),
        )


# Conserva los datos y candidatos de una novedad que necesita aclaracion.
@dataclass(slots=True)
class PendienteAmbiguo:
    nombre: str
    idestado: int | None = None
    estado_codigo: str | None = None
    horas: float | None = None
    horas_extra: float | None = None
    descripcion: str | None = None
    candidatos: list[NominaItem] | None = None
    candidatos_externos: list[NominaItem] | None = None
    mostrando_candidatos_externos: bool = False
    nombre_no_encontrado: bool = False
    idnomina_resuelto: int | None = None
    fuera_de_proyecto: bool = False
    nombre_proyecto: str | None = None
    idproyecto_destino: int | None = None
    contacto_id_destino: int | None = None
    nombre_encargado_destino: str | None = None
    validar_destino_trabajo: bool = False
    destino_pendiente: str | None = None
    opciones_proyecto_destino: list[DestinoProyectoOption] | None = None
    opciones_encargado_destino: list[DestinoEncargadoOption] | None = None
    intentos_estado: int = 0
    reemplaza_novedad: bool = False

    # Indica que aun falta identificar a la persona de esta novedad.
    @property
    def nombre_pendiente(self) -> bool:
        return (self.nombre_no_encontrado or bool(self.candidatos)) and self.idnomina_resuelto is None

    # Indica que falta resolver el motivo de la novedad.
    @property
    def estado_pendiente(self) -> bool:
        return self.idestado is None

    # Indica que la transferencia necesita una obra destino.
    @property
    def obra_destino_pendiente(self) -> bool:
        return self.fuera_de_proyecto and self.destino_pendiente == "obra"

    # Indica que la transferencia necesita un encargado destino.
    @property
    def encargado_destino_pendiente(self) -> bool:
        return self.fuera_de_proyecto and self.destino_pendiente == "encargado"

    # Serializa los datos para conservarlos en el borrador.
    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["candidatos"] = [item.to_dict() for item in self.candidatos] if self.candidatos else None
        payload["candidatos_externos"] = (
            [item.to_dict() for item in self.candidatos_externos] if self.candidatos_externos else None
        )
        payload["opciones_proyecto_destino"] = (
            [item.to_dict() for item in self.opciones_proyecto_destino]
            if self.opciones_proyecto_destino
            else None
        )
        payload["opciones_encargado_destino"] = (
            [item.to_dict() for item in self.opciones_encargado_destino]
            if self.opciones_encargado_destino
            else None
        )
        return payload

    # Reconstruye los datos desde su representacion serializada.
    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "PendienteAmbiguo":
        candidates = raw.get("candidatos")
        external_candidates = raw.get("candidatos_externos")
        project_options = raw.get("opciones_proyecto_destino")
        manager_options = raw.get("opciones_encargado_destino")
        return cls(
            nombre=str(raw.get("nombre") or ""),
            idestado=raw.get("idestado"),
            estado_codigo=str(raw.get("estado_codigo") or "").upper() or None,
            horas=_float_or_none(raw.get("horas")),
            horas_extra=_float_or_none(raw.get("horas_extra")),
            descripcion=raw.get("descripcion"),
            candidatos=[NominaItem.from_dict(item) for item in candidates] if isinstance(candidates, list) else None,
            candidatos_externos=(
                [NominaItem.from_dict(item) for item in external_candidates]
                if isinstance(external_candidates, list)
                else None
            ),
            mostrando_candidatos_externos=bool(raw.get("mostrando_candidatos_externos")),
            nombre_no_encontrado=bool(raw.get("nombre_no_encontrado")),
            idnomina_resuelto=raw.get("idnomina_resuelto"),
            fuera_de_proyecto=bool(raw.get("fuera_de_proyecto")),
            nombre_proyecto=raw.get("nombre_proyecto"),
            idproyecto_destino=raw.get("idproyecto_destino"),
            contacto_id_destino=raw.get("contacto_id_destino"),
            nombre_encargado_destino=raw.get("nombre_encargado_destino"),
            validar_destino_trabajo=bool(raw.get("validar_destino_trabajo")),
            destino_pendiente=str(raw.get("destino_pendiente") or "").strip() or None,
            opciones_proyecto_destino=(
                [
                    parsed
                    for item in project_options
                    if isinstance(item, dict)
                    for parsed in [DestinoProyectoOption.from_dict(item)]
                    if parsed is not None
                ]
                if isinstance(project_options, list)
                else None
            ),
            opciones_encargado_destino=(
                [
                    parsed
                    for item in manager_options
                    if isinstance(item, dict)
                    for parsed in [DestinoEncargadoOption.from_dict(item)]
                    if parsed is not None
                ]
                if isinstance(manager_options, list)
                else None
            ),
            intentos_estado=int(raw.get("intentos_estado") or 0),
            reemplaza_novedad=bool(raw.get("reemplaza_novedad")),
        )


# Agrupa las alternativas de novedad que el usuario debe resolver.
@dataclass(slots=True)
class ConflictoNovedad:
    idnomina: int
    nombre: str
    opciones: list[NovedadPersonal]

    # Serializa los datos para conservarlos en el borrador.
    def to_dict(self) -> dict[str, Any]:
        return {
            "idnomina": self.idnomina,
            "nombre": self.nombre,
            "opciones": [item.to_dict() for item in self.opciones],
        }

    # Reconstruye los datos desde su representacion serializada.
    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "ConflictoNovedad":
        return cls(
            idnomina=int(raw["idnomina"]),
            nombre=str(raw.get("nombre") or ""),
            opciones=[NovedadPersonal.from_dict(item) for item in raw.get("opciones") or []],
        )


# Conserva exclusivamente los datos del borrador, sin controlar la conversacion.
@dataclass(slots=True)
class ParteDiarioDraft:
    oportunidad_id: int
    idproyecto: int | None = None
    contacto_id: int | None = None
    fecha: str | None = None
    parte_id: int | None = None
    novedades: list[NovedadPersonal] = field(default_factory=list)
    # ALT, BAJ y TRA ocupan la novedad del empleado, pero no pertenecen al borrador editable.
    novedades_internas: list[NovedadPersonal] = field(default_factory=list)
    sin_novedades_informado: bool = False
    pendientes_ambiguos: list[PendienteAmbiguo] = field(default_factory=list)
    conflictos_novedad: list[ConflictoNovedad] = field(default_factory=list)
    fecha_propuesta: str | None = None
    retomado: bool = False

    # Serializa los datos para conservarlos en el borrador.
    def to_dict(self) -> dict[str, Any]:
        return {
            "oportunidad_id": self.oportunidad_id,
            "idproyecto": self.idproyecto,
            "contacto_id": self.contacto_id,
            "fecha": self.fecha,
            "parte_id": self.parte_id,
            "novedades": [item.to_dict() for item in self.novedades],
            "novedades_internas": [item.to_dict() for item in self.novedades_internas],
            "sin_novedades_informado": self.sin_novedades_informado,
            "pendientes_ambiguos": [item.to_dict() for item in self.pendientes_ambiguos],
            "conflictos_novedad": [item.to_dict() for item in self.conflictos_novedad],
            "fecha_propuesta": self.fecha_propuesta,
            "retomado": self.retomado,
        }

    # Reconstruye los datos desde su representacion serializada.
    @classmethod
    def from_dict(
        cls,
        raw: dict[str, Any] | None,
        *,
        oportunidad_id: int,
        idproyecto: int | None = None,
    ) -> "ParteDiarioDraft":
        data = raw or {}
        return cls(
            oportunidad_id=oportunidad_id,
            idproyecto=data.get("idproyecto") or idproyecto,
            contacto_id=data.get("contacto_id"),
            fecha=data.get("fecha"),
            parte_id=data.get("parte_id"),
            novedades=[NovedadPersonal.from_dict(item) for item in data.get("novedades") or []],
            novedades_internas=[
                NovedadPersonal.from_dict(item) for item in data.get("novedades_internas") or []
            ],
            sin_novedades_informado=bool(data.get("sin_novedades_informado")),
            pendientes_ambiguos=[
                PendienteAmbiguo.from_dict(item) for item in data.get("pendientes_ambiguos") or []
            ],
            conflictos_novedad=[
                ConflictoNovedad.from_dict(item) for item in data.get("conflictos_novedad") or []
            ],
            fecha_propuesta=data.get("fecha_propuesta"),
            retomado=bool(data.get("retomado")),
        )

    # Copia el borrador sin compartir sus listas de novedades y pendientes.
    def copy(self) -> "ParteDiarioDraft":
        return self.from_dict(self.to_dict(), oportunidad_id=self.oportunidad_id, idproyecto=self.idproyecto)

# endregion
