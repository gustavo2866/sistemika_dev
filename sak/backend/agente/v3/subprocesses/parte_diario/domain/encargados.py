"""Consultas y resolucion de encargados destino del parte diario."""

from __future__ import annotations

import re
from sqlmodel import Session, select

from app.models import CRMContacto, ProyectoEncargado
from agente.v3.subprocesses.parte_diario.domain.models import DestinoEncargadoOption, PendienteAmbiguo
from agente.v3.subprocesses.parte_diario.models import ParteDiarioOperation
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text, _normalize_command


# region Encargados destino

# Asigna el unico encargado, busca uno mencionado o deja pendiente su seleccion.
def resolver_destino(
    session: Session,
    target: ParteDiarioOperation | PendienteAmbiguo,
    *,
    message_text: str,
) -> None:
    destination_id = target.idproyecto_destino
    if destination_id is None:
        target.destino_pendiente = "obra"
        return
    managers = listar_destino(session, int(destination_id))
    if not managers:
        target.destino_pendiente = "encargado"
        target.opciones_encargado_destino = []
        return
    if len(managers) == 1:
        selected = managers[0]
        target.contacto_id_destino = selected.contacto_id
        target.nombre_encargado_destino = selected.nombre
        target.destino_pendiente = None
        target.opciones_encargado_destino = None
        return
    selected = buscar_en_texto(
        message_text,
        managers,
        project_text=target.nombre_proyecto,
    )
    if selected is not None:
        target.contacto_id_destino = selected.contacto_id
        target.nombre_encargado_destino = selected.nombre
        target.destino_pendiente = None
        target.opciones_encargado_destino = None
        return
    target.destino_pendiente = "encargado"
    target.opciones_encargado_destino = managers


# Lista encargados activos de la obra destino, con el principal primero.
def listar_destino(session: Session, project_id: int) -> list[DestinoEncargadoOption]:
    rows = session.exec(
        select(ProyectoEncargado, CRMContacto)
        .join(CRMContacto, CRMContacto.id == ProyectoEncargado.contacto_id)
        .where(ProyectoEncargado.proyecto_id == project_id)
        .where(ProyectoEncargado.activo.is_(True))
        .where(ProyectoEncargado.deleted_at.is_(None))
        .where(CRMContacto.deleted_at.is_(None))
        .order_by(ProyectoEncargado.principal.desc(), CRMContacto.nombre_completo.asc())
    ).all()
    return [
        DestinoEncargadoOption(
            opcion=index,
            contacto_id=int(contact.id),
            nombre=etiqueta(contact),
        )
        for index, (_assignment, contact) in enumerate(rows, start=1)
        if contact.id is not None
    ]


# Busca un encargado unico por nombre evitando coincidencias debidas al nombre de la obra.
def buscar_en_texto(
    message_text: str,
    managers: list[DestinoEncargadoOption],
    *,
    project_text: str | None = None,
) -> DestinoEncargadoOption | None:
    normalized_message = normalize_text(message_text)
    if not normalized_message:
        return None
    ignored_tokens = _tokens_de_obra(project_text)
    message_tokens = set(normalized_message.split())
    exact_matches = []
    for manager in managers:
        manager_name = normalize_text(manager.nombre)
        manager_tokens = set(manager_name.split())
        decisive_tokens = {token for token in manager_tokens if token not in ignored_tokens}
        has_decisive_token = bool(decisive_tokens & message_tokens)
        if manager_name and (
            manager_name == normalized_message
            or manager_name in normalized_message
            or (normalized_message in manager_name and has_decisive_token)
        ):
            if not ignored_tokens or has_decisive_token or manager_name == normalized_message:
                exact_matches.append(manager)
    exact_unique = {item.contacto_id: item for item in exact_matches}
    if len(exact_unique) == 1:
        return next(iter(exact_unique.values()))
    token_counts: dict[str, int] = {}
    manager_tokens_by_id: dict[int, list[str]] = {}
    for manager in managers:
        tokens = [
            token
            for token in normalize_text(manager.nombre).split()
            if len(token) >= 3 and token not in ignored_tokens
        ]
        manager_tokens_by_id[manager.contacto_id] = tokens
        for token in set(tokens):
            token_counts[token] = token_counts.get(token, 0) + 1
    matches = []
    for manager in managers:
        tokens = [
            token
            for token in manager_tokens_by_id.get(manager.contacto_id, [])
            if token_counts.get(token) == 1
        ]
        if tokens and any(token in message_tokens for token in tokens):
            matches.append(manager)
    unique = {item.contacto_id: item for item in matches}
    return next(iter(unique.values())) if len(unique) == 1 else None


# Extrae palabras de la obra que no deben decidir el match del encargado.
def _tokens_de_obra(project_text: str | None) -> set[str]:
    return {
        token
        for token in normalize_text(project_text).split()
        if len(token) >= 3
    }


# Resuelve el encargado por numero de opcion o por nombre.
def seleccionar(
    text: str,
    managers: list[DestinoEncargadoOption],
    *,
    project_text: str | None = None,
) -> DestinoEncargadoOption | None:
    command = _normalize_command(text)
    numbers = re.findall(r"\d+", command)
    if len(numbers) == 1:
        selected_index = int(numbers[0])
        return next((item for item in managers if item.opcion == selected_index), None)
    return buscar_en_texto(text, managers, project_text=project_text)


# Obtiene una etiqueta de contacto usando nombre, correo o identificador.
def etiqueta(contact: CRMContacto) -> str:
    return str(contact.nombre_completo or contact.email or contact.id)

# endregion
