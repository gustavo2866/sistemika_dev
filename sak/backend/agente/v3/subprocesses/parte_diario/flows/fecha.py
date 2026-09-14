"""Seleccion y preparacion de fecha.

Entrada: cargar_fecha, seleccionar_fecha o pendientes.
Salida: carga con borrador preparado, menu de fechas o finalizado.
La consulta del modelo pertenece a domain; este modulo no persiste partes.
"""

from __future__ import annotations

import re
from sqlmodel import Session
from agente.v3.subprocesses.parte_diario.domain.models import EstadoItem, ParteDiarioDraft
from agente.v3.subprocesses.parte_diario.models import TurnResult
from datetime import date, timedelta
from agente.v3.subprocesses.parte_diario.utils import calendario
from typing import TYPE_CHECKING

from agente.v3.contracts import V3InboundMessage
from agente.v3.subprocesses.parte_diario.domain import parte_diario
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text
from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State
from agente.v3.subprocesses.parte_diario.utils import renderer
from agente.v3.subprocesses.parte_diario.utils.calendario import dia_operativo_anterior

if TYPE_CHECKING:
    from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient


# Selecciona una fecha, recupera su borrador o presenta los partes disponibles.
async def procesar(
    message: V3InboundMessage, state: ParteDiarioV3State, llm_client: ParteDiarioLLMClient,
) -> str:
    command = normalize_text(message.text)
    if command == "salir":
        state.etapa = "finalizado"
        return "Finalizamos la seleccion de partes diarios."

    preparando = state.etapa == "cargar_fecha"
    text = state.texto_fecha_inicial if preparando and state.texto_fecha_inicial is not None else (message.text or "")
    state.texto_fecha_inicial = None
    if not state.opciones_fecha:
        state.opciones_fecha = (
            parte_diario.pending_parts_last_days_options(state)
            if state.modo_pendientes or state.etapa == "pendientes"
            else parte_diario.build_fecha_options(int(state.proyecto_id), contacto_id=state.contacto_id)
        )
    if preparando and state.modo_pendientes:
        return mostrar_menu(state)

    selected = None
    if not preparando:
        state.modo_apertura = "puntual"
        selected = next((item for item in state.opciones_fecha if str(item.opcion) == command), None)
    fecha = selected.fecha if selected else await interpretar(text, state, llm_client)
    if fecha is not None or state.fecha_referida_explicita or calendario.tiene_referencia_fecha(text):
        state.modo_apertura = "puntual"
    if fecha is None and (state.fecha_referida_explicita or calendario.tiene_referencia_fecha(text)):
        return mostrar_menu(state, "No pude resolver la fecha indicada entre los partes disponibles.")
    if fecha is None and preparando:
        fecha = state.draft().fecha
        if fecha is None:
            hoy = calendario.hoy()
            anterior = dia_operativo_anterior(hoy).isoformat()
            previo = next((item for item in state.opciones_fecha if item.fecha == anterior), None)
            fecha = hoy.isoformat() if previo and previo.estado in {"confirmado", "cerrado"} else anterior
    if fecha is None:
        return mostrar_menu(state)

    target = date.fromisoformat(fecha)
    if target > calendario.hoy():
        return mostrar_menu(state, "No se puede cargar un parte con fecha futura.")
    selected = next((item for item in state.opciones_fecha if item.fecha == fecha), None)
    if not preparando and selected is None:
        return mostrar_menu(state, "La fecha no pertenece a las opciones disponibles.")

    error, cerrado = parte_diario.preparar_borrador_fecha(state, fecha)
    if error:
        return mostrar_menu(state, error)
    state.opciones_fecha = []
    state.fecha_referida_explicita = False
    state.etapa = "finalizado" if cerrado else "carga"
    if cerrado:
        return renderer.consulta(state.draft())
    return f"Obra: {state.nombre_obra}\nFecha: {fecha}\nBorrador preparado."


# Prepara la apertura automatica de hoy sin arrastrar novedades ni menus del anterior.
def iniciar_hoy(state: ParteDiarioV3State) -> None:
    state.etapa = "cargar_fecha"
    state.texto_fecha_inicial = ""
    state.parte_state = {"fecha": calendario.hoy().isoformat()}
    state.opciones_fecha = []
    state.fecha_referida_explicita = False
    state.modo_pendientes = False
    state.asistencia_opciones = []
    state.asistencia_offset = 0
    state.validacion_origen = None
    state.aclaracion_origen = None
    state.aclaracion_pregunta = None
    state.accion_cierre = None
    state.salida_origen = None
    state.fecha_siguiente = None
    state.historial = []


# Resuelve fechas explicitas y dias de semana; consulta el LLM si hace falta.
async def interpretar(
    text: str, state: ParteDiarioV3State, llm_client: ParteDiarioLLMClient,
) -> str | None:
    command = normalize_text(text)
    match = re.search(r"\b(\d{4}-\d{1,2}-\d{1,2})\b", text)
    short = re.search(r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b", text)
    if match or short:
        state.fecha_referida_explicita = True
    try:
        if match:
            return date.fromisoformat(match.group(1)).isoformat()
        if short:
            day, month, year = short.groups()
            year = int(year) if year else calendario.hoy().year
            return date(year + 2000 if year < 100 else year, int(month), int(day)).isoformat()
    except ValueError:
        return None
    if re.search(r"\bhoy\b", command):
        return calendario.hoy().isoformat()
    if re.search(r"\bayer\b", command):
        return (calendario.hoy() - timedelta(days=1)).isoformat()
    tokens = set(command.split())
    weekday = next((index for index, name in enumerate(
        ("lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo")
    ) if name in tokens), None)
    if weekday is not None:
        options = parte_diario.pending_parts_last_days_options(state)
        return next((item.fecha for item in options if date.fromisoformat(item.fecha).weekday() == weekday), None)
    if not calendario.tiene_referencia_fecha(text):
        return None
    normalized = await llm_client.normalize_initial_request(text)
    try:
        return date.fromisoformat(str(normalized.get("fecha") or "")).isoformat()
    except ValueError:
        return None


# Presenta las fechas disponibles y deja activa su etapa de seleccion.
def mostrar_menu(state: ParteDiarioV3State, prefix: str = "") -> str:
    if not state.opciones_fecha:
        state.etapa = "finalizado"
        return "No hay fechas disponibles para el parte diario."
    state.etapa = "pendientes" if state.modo_pendientes else "seleccionar_fecha"
    lines = [prefix, f"Obra: {state.nombre_obra}", "Selecciona la fecha del parte diario:"]
    lines.extend(f"{item.opcion}: {item.fecha} ({item.estado})" for item in state.opciones_fecha)
    lines.append("Responde con el numero, la fecha o SALIR.")
    return "\n".join(line for line in lines if line)


# Reconoce selecciones iniciales de fecha para no tratarlas como novedades.
def es_fecha_numerica(text: str) -> bool:
    return bool(re.fullmatch(r"\s*(?:\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}(?:/\d{2,4})?)\s*", text))


# Consume la fecha propuesta y aplica el cambio aceptado al borrador.
def aplicar_cambio_confirmado(session: Session, state: ParteDiarioDraft, estados: list[EstadoItem]) -> TurnResult:
    proposed = state.fecha_propuesta
    state.fecha_propuesta = None
    if not proposed:
        return renderer.respuesta_borrador(state, "No hay un cambio de fecha pendiente.")
    error = parte_diario.aplicar_fecha(session, state, proposed, estados)
    if error:
        return renderer.respuesta_borrador(state, error)
    return renderer.respuesta_borrador(state, renderer.actualizado(state))
