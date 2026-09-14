"""Funciones de dominio vinculadas a obras del parte diario."""

from __future__ import annotations

import logging
import re
import time
from difflib import SequenceMatcher

from agente.v3.subprocesses.parte_diario.domain import encargados
from agente.v3.subprocesses.parte_diario.domain.models import DestinoProyectoOption
from agente.v3.subprocesses.parte_diario.models import ParteDiarioOperation, TurnPlan
from agente.v3.subprocesses.parte_diario.utils import interpretacion
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text, _normalize_command

_ACTIVE_DESTINATION_PROJECT_STATES = ("01-plan", "02-ejecucion", "03-conclusion")

from sqlmodel import Session, select
from app import db

from agente.v3.subprocesses.parte_diario.state import ParteDiarioOption
from app.models import CRMContacto, CRMOportunidad, Nomina, Proyecto, ProyectoEncargado

logger = logging.getLogger(__name__)


# Recupera las obras vinculadas al telefono por encargado, nomina u oportunidad.
def resolver_obras_por_telefono(phone: str) -> list[ParteDiarioOption]:
    started = time.perf_counter()
    normalized_phone = normalizar_telefono(phone)
    if not normalized_phone:
        logger.info("v3_parte_diario_resolve_obra_timing phone_empty=true total_ms=%s", 0)
        return []
    with Session(db.engine) as session:
        contacts = session.exec(select(CRMContacto)).all()
        matched_contacts = [
            contact
            for contact in contacts
            if any(normalizar_telefono(value) == normalized_phone for value in (contact.telefonos or []))
        ]
        options: list[ParteDiarioOption] = []
        for contact in matched_contacts:
            added_project_ids: set[int] = set()

            # Agrega una obra una sola vez y conserva su oportunidad y contacto.
            def add_project_option(
                proyecto: Proyecto | None,
                *,
                oportunidad_id: int | None = None,
                nombre: str | None = None,
            ) -> None:
                if (
                    proyecto is None
                    or proyecto.id is None
                    or proyecto.deleted_at is not None
                    or contact.id is None
                ):
                    return
                resolved_oportunidad_id = oportunidad_id or proyecto.oportunidad_id
                if resolved_oportunidad_id is None:
                    return
                proyecto_id = int(proyecto.id)
                if proyecto_id in added_project_ids:
                    return
                added_project_ids.add(proyecto_id)
                options.append(
                    ParteDiarioOption(
                        opcion=len(options) + 1,
                        nombre=nombre or proyecto.nombre or f"Obra {proyecto.id}",
                        contacto_id=int(contact.id),
                        oportunidad_id=int(resolved_oportunidad_id),
                        proyecto_id=proyecto_id,
                    )
                )

            asignaciones = session.exec(
                select(ProyectoEncargado)
                .where(ProyectoEncargado.contacto_id == contact.id)
                .where(ProyectoEncargado.activo.is_(True))
                .where(ProyectoEncargado.deleted_at.is_(None))
            ).all()
            for asignacion in asignaciones:
                proyecto = session.get(Proyecto, asignacion.proyecto_id)
                add_project_option(proyecto)

            nomina_project_ids = session.exec(
                select(Nomina.idproyecto)
                .where(Nomina.encargado_contacto_id == contact.id)
                .where(Nomina.activo.is_(True))
                .where(Nomina.deleted_at.is_(None))
                .where(Nomina.idproyecto.is_not(None))
                .distinct()
            ).all()
            for proyecto_id in nomina_project_ids:
                add_project_option(session.get(Proyecto, proyecto_id))

            if added_project_ids:
                continue

            oportunidades = session.exec(
                select(CRMOportunidad).where(CRMOportunidad.contacto_id == contact.id)
            ).all()
            for oportunidad in oportunidades:
                proyecto = session.exec(
                    select(Proyecto).where(Proyecto.oportunidad_id == oportunidad.id).limit(1)
                ).first()
                add_project_option(
                    proyecto,
                    oportunidad_id=int(oportunidad.id) if oportunidad.id is not None else None,
                    nombre=(
                        proyecto.nombre
                        if proyecto is not None and proyecto.nombre
                        else oportunidad.titulo or f"Obra {proyecto.id}" if proyecto is not None else None
                    ),
                )
        logger.info(
            "v3_parte_diario_resolve_obra_timing phone=%s contacts=%s matched_contacts=%s options=%s total_ms=%s",
            normalized_phone,
            len(contacts),
            len(matched_contacts),
            len(options),
            round((time.perf_counter() - started) * 1000, 3),
        )
        return options


# Compara telefonos por sus digitos, sin signos ni espacios.
def normalizar_telefono(value: str | None) -> str:
    return re.sub(r"\D", "", value or "")


# region Busqueda y resolucion de destinos

# Recupera los nombres de las obras referenciadas por detalles y empleados.
def nombres_por_ids(session: Session, ids: set[int] | None = None) -> dict[int, str]:
    if ids == set():
        return {}
    query = select(Proyecto)
    if ids is not None:
        query = query.where(Proyecto.id.in_(ids))
    return {item.id: item.nombre for item in session.exec(query).all()}

# Recupera el proyecto vigente asociado a la oportunidad del contexto.
def buscar_por_oportunidad(session: Session, oportunidad_id: int) -> Proyecto | None:
    return session.exec(
        select(Proyecto)
        .where(Proyecto.oportunidad_id == oportunidad_id)
        .where(Proyecto.deleted_at.is_(None))
    ).first()


# Completa el destino de las novedades que indican trabajo en otra obra.
def resolver_operaciones_destino(
    session: Session,
    plan: TurnPlan,
    current_project_id: int,
    message_text: str = "",
) -> str | None:
    for operation in plan.operations:
        if operation.type not in {"agregar_novedad", "modificar_novedad"}:
            continue
        if not _is_destination_work_operation(operation):
            continue
        operation.validar_destino_trabajo = True
        operation.fuera_de_proyecto = True
        operation_text = interpretacion._message_text_for_operation(operation, message_text)
        resolver_destino(session,
            operation,
            current_project_id=current_project_id,
            message_text=operation_text,
        )
        operation.estado_codigo = operation.estado_codigo or "P"
    return None


# Resuelve la obra destino o conserva sus opciones antes de buscar al encargado.
def resolver_destino(
    session: Session,
    operation: ParteDiarioOperation,
    *,
    current_project_id: int,
    message_text: str,
) -> None:
    if operation.idproyecto_destino is None:
        resolved_project_id, resolved_project_name, project_options = resolver_nombre_destino(session,
            operation.nombre_proyecto,
            current_project_id,
        )
        if resolved_project_id is None:
            operation.destino_pendiente = "obra"
            operation.opciones_proyecto_destino = project_options
            return
        operation.idproyecto_destino = resolved_project_id
        operation.nombre_proyecto = resolved_project_name
    encargados.resolver_destino(session, operation, message_text=message_text)


# Busca una obra activa distinta de la actual y devuelve el match o las opciones.
def resolver_nombre_destino(
    session: Session,
    project_text: str | None,
    current_project_id: int,
) -> tuple[int | None, str | None, list[DestinoProyectoOption]]:
    query = str(project_text or "").strip()
    projects = list(
        session.exec(
            select(Proyecto)
            .where(Proyecto.deleted_at.is_(None))
            .where(Proyecto.id != current_project_id)
            .where(
                (Proyecto.estado.is_(None))
                | (Proyecto.estado.in_(_ACTIVE_DESTINATION_PROJECT_STATES))
            )
            .order_by(Proyecto.nombre.asc())
        ).all()
    )
    all_options = _project_options(projects)
    if not query:
        return None, None, all_options
    matches = [
        (project_match_score(query, project.nombre), project)
        for project in projects
    ]
    matches = [(score, project) for score, project in matches if score >= 0.55]
    matches.sort(key=lambda pair: (-pair[0], str(pair[1].nombre or "")))
    if not matches:
        return None, None, all_options
    best_score, best_project = matches[0]
    close = [project for score, project in matches if best_score - score <= 0.05]
    if len(close) > 1:
        return None, None, _project_options(close)
    return int(best_project.id), str(best_project.nombre or "").strip(), []


# Puntua coincidencias exactas, parciales y aproximadas entre nombres de obra.
def project_match_score(query: str | None, project_name: str | None) -> float:
    normalized_query = normalize_text(query)
    normalized_name = normalize_text(project_name)
    if not normalized_query or not normalized_name:
        return 0.0
    if normalized_query == normalized_name:
        return 1.0
    if normalized_query in normalized_name:
        return 0.95
    query_tokens = {token for token in normalized_query.split() if len(token) >= 3}
    name_tokens = {token for token in normalized_name.split() if len(token) >= 3}
    if query_tokens and query_tokens <= name_tokens:
        return 0.9
    if query_tokens and query_tokens & name_tokens:
        return 0.75
    token_similarity = max(
        (
            SequenceMatcher(None, query_token, name_token).ratio()
            for query_token in query_tokens
            for name_token in name_tokens
        ),
        default=0.0,
    )
    full_similarity = SequenceMatcher(None, normalized_query, normalized_name).ratio()
    return max(token_similarity, full_similarity)


# Usa solo el destino interpretado para esta persona; las horas no implican transferencia.
def _is_destination_work_operation(operation: ParteDiarioOperation) -> bool:
    if operation.type not in {"agregar_novedad", "modificar_novedad"}:
        return False
    normalized_code = str(operation.estado_codigo or "").strip().upper()
    if normalized_code and normalized_code != "P":
        return False
    return bool(
        operation.fuera_de_proyecto
        or str(operation.nombre_proyecto or "").strip()
        or operation.idproyecto_destino is not None
    )


# Construye hasta diez opciones numeradas con las obras que tienen ID y nombre.
def _project_options(projects: list[Proyecto]) -> list[DestinoProyectoOption]:
    return [
        DestinoProyectoOption(
            opcion=index,
            proyecto_id=int(project.id),
            nombre=str(project.nombre or "").strip(),
        )
        for index, project in enumerate(projects[:10], start=1)
        if project.id is not None and str(project.nombre or "").strip()
    ]


# Resuelve una seleccion de obra por numero o nombre entre las opciones ofrecidas.
def _match_destination_project(
    text: str,
    projects: list[DestinoProyectoOption],
) -> DestinoProyectoOption | None:
    command = _normalize_command(text)
    numbers = re.findall(r"\d+", command)
    if len(numbers) == 1:
        selected_index = int(numbers[0])
        return next((item for item in projects if item.opcion == selected_index), None)
    normalized_text = normalize_text(text)
    matches = [
        item
        for item in projects
        if normalized_text and normalize_text(item.nombre) in normalized_text
    ]
    if not matches:
        matches = [
            item
            for item in projects
            if project_match_score(normalized_text, item.nombre) >= 0.75
        ]
    return matches[0] if len(matches) == 1 else None

# endregion
