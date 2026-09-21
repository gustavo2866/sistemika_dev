"""Propuesta de otro parte despues de guardar.

ofrecer deja continuar con fecha_siguiente, o finalizado si no hay otra fecha.
procesar devuelve texto para esperar/finalizar, o None para seguir en cargar_fecha.
La fecha propuesta es independiente de las aclaraciones de fecha de una novedad.
"""

from agente.v3.subprocesses.parte_diario.domain import parte_diario
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text
from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State
from agente.v3.subprocesses.parte_diario.utils import calendario, renderer
from agente.v3.subprocesses.parte_diario.utils.calendario import dia_operativo_anterior


# Ofrece otra fecha editable excluyendo la que acaba de guardarse o confirmarse.
def ofrecer(state: ParteDiarioV3State, reply: str) -> str:
    options = parte_diario.pending_parts_last_days_options(state, exclude_fechas={state.draft().fecha})
    if not options:
        state.etapa = "finalizado"
        return reply
    hoy = calendario.hoy()
    preferred = (dia_operativo_anterior(hoy).isoformat(), hoy.isoformat())
    available_dates = {option.fecha for option in options}
    state.fecha_siguiente = next((fecha for fecha in preferred if fecha in available_dates), options[0].fecha)
    state.etapa = "continuar"
    return f"{reply}\n\n{renderer.propuesta_continuar(state.fecha_siguiente)}"


# Acepta la propuesta y prepara una nueva carga o finaliza el subproceso.
def procesar(text: str, state: ParteDiarioV3State) -> str | None:
    command = normalize_text(text)
    if command in {"no", "2", "salir", "finalizar"}:
        state.etapa = "finalizado"
        return "Carga de partes diarios finalizada."
    if command not in {"si", "1", "continuar", "cargar", "seguir cargando"}:
        return renderer.propuesta_continuar(state.fecha_siguiente)
    state.texto_fecha_inicial = state.fecha_siguiente
    state.fecha_siguiente = None
    state.parte_state = {}
    state.opciones_fecha = []
    state.modo_pendientes = False
    state.accion_cierre = None
    state.fecha_referida_explicita = False
    state.validacion_origen = None
    state.asistencia_opciones = []
    state.asistencia_catalogo = []
    state.asistencia_offset = 0
    state.revision_origen = None
    state.etapa = "cargar_fecha"
    return None
