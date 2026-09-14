"""Resumen y decision de guardado en revision.

1 guarda, 2 vuelve a carga y SALIR pide confirmar el descarte.
procesar devuelve (respuesta, metadata de persistencia); los rechazos conservan
revision y el borrador. El estado BORRADOR/CONFIRMADO lo decide domain al guardar.
"""

import logging

from agente.v3.contracts import V3InboundMessage
from agente.v3.subprocesses.parte_diario.domain import parte_diario
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text
from agente.v3.subprocesses.parte_diario.flows import confirmar_salida, fecha
from agente.v3.subprocesses.parte_diario.utils import calendario
from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State
from agente.v3.subprocesses.parte_diario.utils import renderer

logger = logging.getLogger(__name__)


# Presenta el resumen y deja la decision de persistencia para el siguiente mensaje.
def iniciar(state: ParteDiarioV3State) -> str:
    state.etapa = "revision"
    state.accion_cierre = "guardar"
    return renderer.menu_revision(state)


# Guarda o vuelve a carga segun la opcion elegida, sin otra confirmacion.
def procesar(message: V3InboundMessage, state: ParteDiarioV3State) -> tuple[str, dict]:
    command = normalize_text(message.text)
    if command in {"volver", "editar", "seguir editando", "2"}:
        state.etapa = "carga"
        state.accion_cierre = None
        return renderer.inicio_carga(state), {}
    if command == "salir":
        return confirmar_salida.iniciar(state), {}
    if command not in {"guardar", "guardar borrador", "1", "cerrar", "finalizar", "finalizar parte", "ok", "confirmar", "si"}:
        return renderer.menu_revision(state), {}

    try:
        metadata = parte_diario.persistir_borrador(state, message)
    except ValueError as exc:
        return f"No se guardo el parte: {exc}\n\n{renderer.menu_revision(state)}", {"status": "save_rejected"}
    except Exception:
        logger.exception("No se pudo persistir el parte diario")
        return ("No se pudo guardar el parte. El borrador se conserva para reintentar.\n\n"
                + renderer.menu_revision(state)), {"status": "persistence_error"}

    state.accion_cierre = "guardar"
    state.etapa = "finalizado"
    reply = "Parte diario confirmado." if metadata["status"] == "confirmed" else "Parte diario guardado como borrador."
    if state.modo_apertura == "diario" and state.draft().fecha < calendario.hoy().isoformat():
        fecha.iniciar_hoy(state)
    return reply, metadata
