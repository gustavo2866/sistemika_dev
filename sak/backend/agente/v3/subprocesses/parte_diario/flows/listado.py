"""Entrada numerada y navegacion dirigida del estado LISTADO.

El catalogo congelado conserva numeros e identidades durante todo el recorrido.
normalizar solo convierte opciones visibles a IDs; la interpretacion, validacion
y aplicacion de novedades siguen el mismo camino comun que la carga de texto libre.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from agente.v3.subprocesses.parte_diario.domain.empleados import listar_para_carga
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text
from agente.v3.subprocesses.parte_diario.flows import carga, confirmar_salida
from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State
from agente.v3.subprocesses.parte_diario.utils import renderer

if TYPE_CHECKING:
    from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient
    from agente.v3.subprocesses.parte_diario.domain.models import NovedadPersonal
    from agente.v3.subprocesses.parte_diario.state import ParteDiarioAsistenciaOption

PAGE_SIZE = 8


# Atiende la navegacion del listado y normaliza la seleccion para el interprete comun.
async def procesar(text: str | None, state: ParteDiarioV3State, llm_client: ParteDiarioLLMClient) -> str:
    if text is None:
        return mostrar(state)
    command = normalize_text(text)
    if command == "salir":
        return confirmar_salida.iniciar(state)
    if command in {"99", "finalizar"}:
        return finalizar(state)
    siguiente = opcion_siguiente(state)
    if command == "siguiente" or (siguiente is not None and command == str(siguiente)):
        return avanzar(state)
    if not state.asistencia_opciones:
        return mostrar(state)
    text, error = normalizar(text, state)
    if error:
        return mostrar(state, error)
    return await carga.interpretar_novedades(text, state, llm_client)


# Inicia el listado del encargado desde la primera pagina.
def iniciar(state: ParteDiarioV3State) -> str:
    state.etapa = "listado"
    state.asistencia_offset = 0
    state.asistencia_catalogo = listar_para_carga(state)
    state.asistencia_opciones = []
    state.revision_origen = None
    return mostrar(state)


# Muestra una pagina estable de empleados y las novedades ya cargadas.
def mostrar(state: ParteDiarioV3State, prefix: str = "") -> str:
    if not state.asistencia_catalogo:
        # Recuperacion unica de contextos LISTADO creados antes del catalogo congelado.
        state.asistencia_catalogo = listar_para_carga(state)
    empleados = state.asistencia_catalogo
    if not empleados:
        return _sin_nomina(state)
    if state.asistencia_offset >= len(empleados):
        return finalizar(state, prefix)
    state.asistencia_opciones = empleados[state.asistencia_offset:state.asistencia_offset + PAGE_SIZE]
    page = state.asistencia_offset // PAGE_SIZE + 1
    pages = (len(empleados) + PAGE_SIZE - 1) // PAGE_SIZE
    draft = state.draft()
    novedades = {item.idnomina: item for item in draft.novedades_internas}
    novedades.update({item.idnomina: item for item in draft.novedades})
    current_ids = {item.idnomina for item in state.asistencia_opciones}
    catalog_by_id = {item.idnomina: item for item in empleados}
    acumuladas = [
        _novedad_line(option, novedades[option.idnomina])
        for option in empleados
        if option.idnomina in novedades and option.idnomina not in current_ids
    ]
    lines = [
        prefix,
        f"LISTADO - {state.nombre_obra}",
        f"Fecha: {draft.fecha} - Pagina {page} de {pages}",
        "",
    ]
    if acumuladas:
        lines.extend(["Cargado:", *acumuladas, ""])
    lines.extend([
        "Informa todas las novedades de esta pagina en un mensaje.",
        "Formato: numero + novedad.",
        "SALIR abandona el parte.",
        "",
    ])
    for option in state.asistencia_opciones:
        existing = novedades.get(option.idnomina)
        lines.append(_novedad_line(option, existing) if existing else f"{option.opcion} - {option.nombre_completo}")
    siguiente = opcion_siguiente(state)
    lines.append("")
    if siguiente is not None:
        lines.append(f"{siguiente} - SIGUIENTE")
    lines.append("99 - FINALIZAR")
    return "\n".join(lines).strip()


# Avanza al siguiente grupo despues de cargar o descartar la pagina visible.
def avanzar(state: ParteDiarioV3State, prefix: str = "") -> str:
    state.asistencia_offset += PAGE_SIZE
    return mostrar(state, prefix)


# Devuelve el numero correlativo que abre la pagina siguiente, si existe.
def opcion_siguiente(state: ParteDiarioV3State) -> int | None:
    end = state.asistencia_offset + len(state.asistencia_opciones)
    return state.asistencia_catalogo[end].opcion if end < len(state.asistencia_catalogo) else None


# Finaliza LISTADO en revision; guardar sigue perteneciendo al flujo compartido.
def finalizar(state: ParteDiarioV3State, prefix: str = "") -> str:
    if state.asistencia_catalogo:
        last_offset = ((len(state.asistencia_catalogo) - 1) // PAGE_SIZE) * PAGE_SIZE
        state.asistencia_offset = min(state.asistencia_offset, last_offset)
    from agente.v3.subprocesses.parte_diario.flows import revision

    reply = revision.iniciar(state, origen="listado")
    return f"{prefix}\n{reply}".strip()


# Regresa a carga cuando no existe una nomina que permita iniciar LISTADO.
def _sin_nomina(state: ParteDiarioV3State) -> str:
    state.etapa = "carga"
    state.asistencia_offset = 0
    state.asistencia_opciones = []
    state.asistencia_catalogo = []
    return "No hay nomina activa asignada a esta obra y encargado."


# Presenta una novedad con el numero estable del catalogo congelado.
def _novedad_line(
    option: ParteDiarioAsistenciaOption,
    novedad: NovedadPersonal,
) -> str:
    estado = novedad.estado_codigo or "estado pendiente"
    horas = f", {novedad.horas:g}h" if novedad.horas is not None else ""
    es_interna = renderer._is_internal_nomina_state(novedad.estado_codigo)
    motivo = (
        f", {novedad.descripcion}"
        if novedad.descripcion and str(novedad.estado_codigo or "").upper() != "P" and not es_interna
        else ""
    )
    destino = renderer.detalle_destino(novedad)
    destino_text = f" - {destino}" if destino else ""
    return f"{option.opcion} - {option.nombre_completo} - {estado}{horas}{motivo}{destino_text}"


# Devuelve (texto con IDs, None) o (None, error) sin alterar el borrador ni la pagina.
def normalizar(text: str, state: ParteDiarioV3State) -> tuple[str | None, str | None]:
    text = re.sub(r"\s+y\s+(?=\d+\b)", "\n", text, flags=re.IGNORECASE)
    parts = [part.strip() for part in re.split(r"[,;\n]+", text) if part.strip()]
    options = {item.opcion: item for item in state.asistencia_opciones}
    lines = []
    for part in parts:
        match = re.fullmatch(r"(\d+)(?:[).:\-\s]+(.+))?", part)
        if not match:
            return None, "Indica numero y motivo, por ejemplo: 2 enfermedad."
        number = int(match.group(1))
        option = options.get(number)
        if option is None:
            return None, f"El numero {number} no esta en esta pagina."
        motive = (match.group(2) or "falta").strip()
        lines.append(f"[idnomina={option.idnomina}] {option.nombre_completo}: {motive}")
    if not lines:
        return None, "Indica numero y motivo, por ejemplo: 2 enfermedad."
    return "\n".join(lines), None
