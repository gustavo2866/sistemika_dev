"""Dialogo pendiente en carga_aclaracion; reutiliza el interprete y ejecutor comunes."""

from agente.v3.subprocesses.parte_diario.flows import carga, confirmar_salida, listado
from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State
from agente.v3.subprocesses.parte_diario.utils import renderer
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text


# Conserva el origen y la pregunta sin crear otro selector del procesador.
def iniciar(state: ParteDiarioV3State, pregunta: str) -> str:
    if state.etapa != "carga_aclaracion":
        state.aclaracion_origen = state.etapa
    state.etapa = "carga_aclaracion"
    state.aclaracion_pregunta = pregunta
    return pregunta


# Recupera el modo de entrada y libera los datos de la aclaracion completada.
def terminar(state: ParteDiarioV3State) -> None:
    state.etapa = state.aclaracion_origen
    state.aclaracion_origen = None
    state.aclaracion_pregunta = None


# Atiende sus comandos propios; SI y NO se interpretan con la pregunta pendiente.
async def procesar(text: str | None, state: ParteDiarioV3State, llm_client) -> str:
    if text is None:
        return state.aclaracion_pregunta
    command = normalize_text(text)
    if command == "cancelar":
        return confirmar_salida.iniciar(state)
    if command in {"salir", "volver"}:
        terminar(state)
        return listado.mostrar(state) if state.etapa == "listado" else renderer.inicio_carga(state)
    return await carga.interpretar_novedades(text, state, llm_client)
