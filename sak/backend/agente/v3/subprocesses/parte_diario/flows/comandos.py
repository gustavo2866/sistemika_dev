"""Comandos transversales de parte diario, previos al despacho y sin transiciones."""

from sqlmodel import Session
from app import db
from agente.v3.subprocesses.parte_diario.domain import empleados
from agente.v3.subprocesses.parte_diario.flows import validacion_carga
from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State
from agente.v3.subprocesses.parte_diario.utils import calendario, interpretacion, renderer
from agente.v3.subprocesses.parte_diario.utils.texto import _normalize_command

COMANDOS = {"nomina": "mostrar_nomina", "ver nomina": "mostrar_nomina",
            "mostrar nomina": "mostrar_nomina"}


# Responde consultas comunes sin consumir la seleccion, la pregunta ni la pagina activa.
def procesar(text: str, state: ParteDiarioV3State) -> str | None:
    command = _normalize_command(text)
    operation = COMANDOS.get(command)
    if operation is None and state.etapa in validacion_carga.ETAPAS:
        operation = interpretacion._parse_local_readonly_operation(command)
    if operation is None:
        return None
    if not state.has_resolved_obra():
        return "Primero selecciona la obra para consultar su nomina."
    draft = state.draft()
    if operation == "mostrar_parte":
        reply = renderer.mostrar_borrador(draft)
    else:
        with Session(db.engine) as session:
            propias, completas = empleados.cargar_referencias(
                session, state.proyecto_id, contacto_id=state.contacto_id,
                fecha=calendario.parsear_fecha(draft.fecha),
            )
            items = propias if command in COMANDOS else empleados.listar_para_consulta(
                session, state.proyecto_id, contacto_id=state.contacto_id, command=command,
                alcance=None, nominas_completas=completas, fecha=calendario.parsear_fecha(draft.fecha),
            )
        reply = renderer.mostrar_nomina(items)
    if state.etapa == "carga_aclaracion":
        return f"{reply}\n\n{state.aclaracion_pregunta}"
    if state.etapa in validacion_carga.ETAPAS:
        # Preparar la pregunta en una copia evita modificar la cola durante la consulta.
        pregunta = validacion_carga.preparar(ParteDiarioV3State.from_dict(state.to_dict()))
        return f"{reply}\n\n{pregunta}"
    return reply
