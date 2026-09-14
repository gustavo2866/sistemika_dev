"""Entrada numerada del estado listado.

La pagina visible fija que numeros puede usar el usuario. normalizar devuelve
texto con IDs para el interprete comun; no interpreta motivos ni aplica novedades.
NO avanza de pagina y SALIR vuelve a carga sin descartar el borrador.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from agente.v3.subprocesses.parte_diario.domain.empleados import listar_para_carga
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text
from agente.v3.subprocesses.parte_diario.flows import carga
from agente.v3.subprocesses.parte_diario.state import ParteDiarioV3State
from agente.v3.subprocesses.parte_diario.utils import renderer

if TYPE_CHECKING:
    from agente.v3.subprocesses.parte_diario.adapters.llm import ParteDiarioLLMClient

PAGE_SIZE = 8


# Atiende la navegacion del listado y normaliza la seleccion para el interprete comun.
async def procesar(text: str | None, state: ParteDiarioV3State, llm_client: ParteDiarioLLMClient) -> str:
    if text is None:
        return mostrar(state)
    command = normalize_text(text)
    if command == "salir":
        return terminar(state)
    if command in {"no", "nadie", "ninguno", "ninguna"} or command.startswith("no "):
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
    return mostrar(state)


# Muestra una pagina estable de empleados y las novedades ya cargadas.
def mostrar(state: ParteDiarioV3State, prefix: str = "") -> str:
    empleados = listar_para_carga(state)
    if not empleados:
        return terminar(state, "No hay nomina activa asignada a esta obra y encargado.")
    if state.asistencia_offset >= len(empleados):
        return terminar(state, prefix)
    state.asistencia_opciones = empleados[state.asistencia_offset:state.asistencia_offset + PAGE_SIZE]
    start = state.asistencia_offset + 1
    end = state.asistencia_offset + len(state.asistencia_opciones)
    lines = [prefix, f"Listado - {state.nombre_obra}", f"Empleados {start}-{end} de {len(empleados)}:"]
    novedades = {item.idnomina: item for item in state.draft().novedades}
    for option in state.asistencia_opciones:
        existing = novedades.get(option.idnomina)
        suffix = ""
        if existing:
            hours = f", {existing.horas:g}h" if existing.horas is not None and existing.horas != 0 else ""
            suffix = f" - informado: {existing.estado_codigo or 'estado pendiente'}{hours}"
            if existing.descripcion and existing.estado_codigo != "P":
                suffix += f", motivo: {existing.descripcion}"
        lines.append(f"{option.opcion}. {option.nombre_completo}{suffix}")
    lines.extend(["Indica numero y motivo u horas, o responde NO.", "SALIR para terminar listado."])
    return "\n".join(line for line in lines if line)


# Avanza al siguiente grupo despues de cargar o descartar la pagina visible.
def avanzar(state: ParteDiarioV3State, prefix: str = "") -> str:
    state.asistencia_offset += PAGE_SIZE
    return mostrar(state, prefix)


# Regresa a carga conservando todas las novedades del borrador.
def terminar(state: ParteDiarioV3State, prefix: str = "") -> str:
    state.etapa = "carga"
    state.asistencia_offset = 0
    state.asistencia_opciones = []
    return f"{prefix}\n{renderer.resumen(state.draft())}\n\nHay alguna otra novedad?".strip()


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
