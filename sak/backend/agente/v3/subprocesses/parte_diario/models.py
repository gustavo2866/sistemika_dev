"""Contratos del procesamiento: operaciones interpretadas, planes y resultados.

Los datos del negocio se definen en domain/models.py; la conversacion en state.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from agente.v3.subprocesses.parte_diario.domain.models import (
    DestinoProyectoOption, DestinoEncargadoOption, ParteDiarioDraft,
)


# region Contratos de procesamiento

# Operacion normalizada del interprete, con referencias y datos de la novedad.
@dataclass(slots=True)
class ParteDiarioOperation:
    type: str
    nombre: str | None = None
    idnomina: int | None = None
    alcance: str | None = None
    estado_codigo: str | None = None
    horas: float | None = None
    horas_extra: float | None = None
    descripcion: str | None = None
    fuera_de_proyecto: bool = False
    nombre_proyecto: str | None = None
    idproyecto_destino: int | None = None
    contacto_id_destino: int | None = None
    nombre_encargado_destino: str | None = None
    validar_destino_trabajo: bool = False
    destino_pendiente: str | None = None
    opciones_proyecto_destino: list[DestinoProyectoOption] | None = None
    opciones_encargado_destino: list[DestinoEncargadoOption] | None = None
    fecha: str | None = None
    requested: str | None = None
    reply: str | None = None


# Agrupa las operaciones y metadata interpretadas a partir de un mensaje.
@dataclass(slots=True)
class TurnPlan:
    operations: list[ParteDiarioOperation] = field(default_factory=list)
    reply: str | None = None
    raw_response: dict[str, Any] | None = None
    llm_ms: int | None = None

    # Indica si el plan incluye el tipo de operacion consultado.
    def has_type(self, operation_type: str) -> bool:
        return any(operation.type == operation_type for operation in self.operations)

    # Identifica consultas sin modificaciones, aunque seleccionen una fecha.
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


# Transporta el borrador resultante de aplicar operaciones y sus errores.
@dataclass(slots=True)
class ExecutionResult:
    status: str
    next_state: ParteDiarioDraft
    reply: str
    keep_active: bool = True
    parte_listo: bool = False
    cerrar_parte: bool = False
    cancelado: bool = False
    errors: list[str] = field(default_factory=list)
    applied_operations: list[str] = field(default_factory=list)


# Transporta la respuesta y el borrador serializado de un turno.
@dataclass(slots=True)
class TurnResult:
    payload: dict[str, Any] = field(default_factory=dict)
    keep_active: bool = True
    process_state: dict[str, Any] = field(default_factory=dict)

# endregion
