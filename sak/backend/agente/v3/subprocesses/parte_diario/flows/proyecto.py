"""Seleccion del proyecto asociado a un parte cargado sobre una obra generica."""

from sqlmodel import Session

from app import db
from agente.v3.subprocesses.parte_diario.domain import obras
from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State
from agente.v3.subprocesses.parte_diario.utils import renderer
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text


# Abre el menu solo cuando la obra cabecera admite un proyecto asociado.
def iniciar(state: ParteDiarioV3State) -> str:
    draft = state.draft()
    if not draft.proyecto_generico:
        state.opciones_proyecto = []
        state.etapa = "carga"
        return (
            "El comando PROYECTO solo esta disponible para una obra generica.\n\n"
            f"{renderer.inicio_carga(state)}"
        )
    with Session(db.engine) as session:
        state.opciones_proyecto = obras.listar_proyectos_activos(
            session,
            current_project_id=int(state.proyecto_id or 0),
        )
    if not state.opciones_proyecto:
        state.etapa = "carga"
        return (
            "No hay proyectos activos disponibles para asignar.\n\n"
            f"{renderer.inicio_carga(state)}"
        )
    state.etapa = "carga_proyecto"
    return renderer.seleccionar_proyecto(state)


# Aplica la opcion elegida o vuelve a la carga sin alterar la seleccion vigente.
def procesar(text: str | None, state: ParteDiarioV3State) -> str:
    command = normalize_text(text)
    if command == "salir":
        state.opciones_proyecto = []
        state.etapa = "carga"
        return renderer.inicio_carga(state)
    if command == "proyecto":
        return renderer.seleccionar_proyecto(state)
    selected = obras.resolver_proyecto_activo(text or "", state.opciones_proyecto)
    if selected is None:
        return renderer.seleccionar_proyecto(
            state,
            "No pude identificar el proyecto entre las opciones disponibles.",
        )
    draft = state.draft()
    draft.generico_proyecto_id = selected.proyecto_id
    draft.generico_proyecto_nombre = selected.nombre
    state.set_draft(draft)
    state.opciones_proyecto = []
    state.etapa = "carga"
    return f"Proyecto asignado: {selected.nombre}.\n\n{renderer.inicio_carga(state)}"
