"""Menu de entrada y seleccion del modo de apertura del parte diario."""

from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text


MENU_PARTE_DIARIO = "PARTE DIARIO\n1: REPORTAR\n2: PENDIENTES\n3: SALIR"
_PENDIENTES = {
    "2",
    "pendiente",
    "pendientes",
    "parte pendiente",
    "parte pendientes",
    "partes pendiente",
    "partes pendientes",
}


# Distingue el comando sin parametros de las aperturas directas con obra o fecha.
def es_menu_inicial(text: str | None) -> bool:
    return normalize_text(text) in {"parte diario", "partes diarios"}


# Reconoce el acceso directo al circuito diario, con obra opcional.
def es_reportar(text: str | None) -> bool:
    command = normalize_text(text)
    return command == "reportar" or command.startswith("reportar ")


# Reconoce el acceso directo a la seleccion de partes pendientes.
def es_pendientes(text: str | None) -> bool:
    command = normalize_text(text)
    return command in _PENDIENTES or command.startswith("pendientes ")


# Presenta el menu sin resolver todavia obra, fecha ni borrador.
def iniciar(state: ParteDiarioV3State) -> str:
    state.etapa = "seleccionar_accion"
    return MENU_PARTE_DIARIO


# Selecciona un modo; None permite al handler continuar con la resolucion de obra.
def procesar(text: str | None, state: ParteDiarioV3State) -> str | None:
    command = normalize_text(text)
    if command in {"1", "reportar"}:
        state.modo_pendientes = False
        state.modo_apertura = "diario"
        state.etapa = "inicial"
        return None
    if command in _PENDIENTES:
        state.modo_pendientes = True
        state.modo_apertura = "puntual"
        state.etapa = "inicial"
        return None
    if command in {"3", "salir"}:
        state.accion_cierre = "salir"
        state.etapa = "finalizado"
        return "Finalizamos la seleccion de partes diarios."
    return iniciar(state)
