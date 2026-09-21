"""Pregunta de descarte en confirmar_salida.

iniciar conserva salida_origen; procesar descarta o vuelve a ese mismo estado.
No elimina partes guardados ni infiere el estado de retorno a partir del borrador.
"""

from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text
from agente.v3.subprocesses.parte_diario.flows import listado, validacion_carga
from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State
from agente.v3.subprocesses.parte_diario.utils import renderer


# Conserva el estado de origen para poder cancelar la salida sin perder la pregunta activa.
def iniciar(state: ParteDiarioV3State) -> str:
    state.salida_origen = state.etapa
    state.etapa = "confirmar_salida"
    return renderer.confirmar_descarte()


# Descarta solo el borrador conversacional o regresa al estado que solicito la salida.
def procesar(text: str, state: ParteDiarioV3State) -> str:
    command = normalize_text(text)
    if command in {"1", "si", "ok", "descartar", "confirmar"}:
        state.parte_state = {}
        state.salida_origen = None
        state.accion_cierre = "descartar"
        state.etapa = "finalizado"
        return "Cambios no guardados descartados. Los datos guardados no se modificaron."
    if command not in {"2", "no", "volver", "continuar"}:
        return renderer.confirmar_descarte()
    state.etapa = state.salida_origen
    state.salida_origen = None
    if state.etapa in validacion_carga.ETAPAS:
        return validacion_carga.preparar(state)
    if state.etapa == "revision":
        return renderer.menu_revision(state)
    if state.etapa == "listado":
        return listado.mostrar(state)
    if state.etapa == "carga_aclaracion":
        return state.aclaracion_pregunta
    return renderer.inicio_carga(state)
