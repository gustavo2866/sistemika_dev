"""Consultas de nomina, asignaciones y candidatos de empleados del parte diario."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from datetime import date

from sqlmodel import Session, select
from app import db

from agente.v3.subprocesses.parte_diario.domain.models import NominaItem, PendienteAmbiguo
from agente.v3.subprocesses.parte_diario.state import ParteDiarioAsistenciaOption, ParteDiarioV3State
from app.models import CRMContacto, Nomina, Proyecto, Tarja, TarjaNomina
from agente.v3.subprocesses.parte_diario.domain import encargados
from agente.v3.subprocesses.parte_diario.utils import calendario, interpretacion
from agente.v3.subprocesses.parte_diario.utils.texto import normalize_text
from app.utils.quincenas import get_quincena_range


logger = logging.getLogger(__name__)


# Recupera exclusivamente la nomina de tarja vigente para obra, encargado y fecha.
def listar_para_carga(state: ParteDiarioV3State) -> list[ParteDiarioAsistenciaOption]:
    with Session(db.engine) as session:
        _, rows = listar_desde_tarja(
            session, int(state.proyecto_id), contacto_id=state.contacto_id,
            fecha=date.fromisoformat(state.draft().fecha),
        )
        return [
            ParteDiarioAsistenciaOption(
                opcion=index if index < 99 else index + 1,
                idnomina=int(row.id), nombre=row.nombre,
                apellido=row.apellido, nro_legajo=row.nro_legajo,
            )
            for index, row in enumerate(rows, start=1)
        ]


def _tokens(value: str | None) -> set[str]:
    return set(normalize_text(value).split())


def _candidate_search_text(item: NominaItem) -> str:
    return " ".join(
        value
        for value in (
            item.apellido,
            item.nombre,
            item.nombre_completo,
            item.nro_legajo,
        )
        if value
    )


@dataclass(slots=True)
class ResolveResult:
    match: NominaItem | None = None
    candidatos: list[NominaItem] | None = None
    candidatos_externos: list[NominaItem] | None = None
    error: str | None = None

    @property
    def ambiguo(self) -> bool:
        return bool(self.candidatos)


class NominaResolver:
    @staticmethod
    def resolve(
        nombre: str,
        nominas_proyecto: list[NominaItem],
        nominas_completas: list[NominaItem],
    ) -> ResolveResult:
        project_matches = NominaResolver._matches(nombre, nominas_proyecto)
        if len(project_matches) == 1:
            return ResolveResult(match=project_matches[0])
        if len(project_matches) > 1:
            return ResolveResult(candidatos=project_matches)
        return ResolveResult(error=f"No encontre a {nombre} en la nomina vigente de esta obra y encargado.")

    @staticmethod
    def find_similar(
        nombre: str,
        nominas_proyecto: list[NominaItem],
        nominas_completas: list[NominaItem],
    ) -> list[NominaItem]:
        project_similar, external_similar = NominaResolver.find_similar_grouped(
            nombre,
            nominas_proyecto,
            nominas_completas,
        )
        return project_similar or external_similar

    @staticmethod
    def find_similar_grouped(
        nombre: str,
        nominas_proyecto: list[NominaItem],
        nominas_completas: list[NominaItem],
    ) -> tuple[list[NominaItem], list[NominaItem]]:
        project_similar = NominaResolver._similar_matches(nombre, nominas_proyecto)
        return project_similar, []

    @staticmethod
    def _matches(nombre: str, candidates: list[NominaItem]) -> list[NominaItem]:
        searched = _tokens(nombre)
        if not searched:
            return []
        return [
            item
            for item in candidates
            if searched <= _tokens(_candidate_search_text(item))
        ]

    @staticmethod
    def _similar_matches(nombre: str, candidates: list[NominaItem]) -> list[NominaItem]:
        searched_tokens = _tokens(nombre)
        if not searched_tokens:
            return []
        scored: list[tuple[float, NominaItem]] = []
        for item in candidates:
            candidate_tokens = _tokens(_candidate_search_text(item))
            if not candidate_tokens:
                continue
            score = max(
                SequenceMatcher(None, searched, candidate).ratio()
                for searched in searched_tokens
                for candidate in candidate_tokens
            )
            if score >= 0.78:
                scored.append((score, item))
        scored.sort(key=lambda pair: (-pair[0], pair[1].apellido, pair[1].nombre))
        return [item for _, item in scored]


def parse_candidate_selection(
    text: str,
    candidates: list[NominaItem],
    *,
    offset: int = 0,
    visible_count: int | None = None,
) -> NominaItem | None:
    normalized = normalize_text(text)
    numbers = re.findall(r"\d+", normalized)
    if len(numbers) == 1:
        local_index = int(numbers[0]) - 1
        if visible_count is not None and not 0 <= local_index < visible_count:
            return None
        index = offset + local_index
        return candidates[index] if 0 <= index < len(candidates) else None
    searched = _tokens(normalized) - {"el", "la", "de", "del"}
    if not searched:
        return None
    matches = [
        item for item in candidates
        if searched <= _tokens(_candidate_search_text(item))
    ]
    return matches[0] if len(matches) == 1 else None


def filter_candidate_selection(text: str, candidates: list[NominaItem]) -> list[NominaItem]:
    normalized = normalize_text(text)
    if normalized.isdigit():
        return []
    searched = _tokens(normalized) - {"el", "la", "de", "del"}
    if not searched:
        return []
    return [
        item for item in candidates
        if searched <= _tokens(_candidate_search_text(item))
    ]


# region Nomina de referencia y consultas

# Recupera los empleados necesarios para describir detalles, en una sola consulta.
def obtener_por_ids(session: Session, ids: set[int]) -> dict[int, Nomina]:
    if not ids:
        return {}
    return {item.id: item for item in session.exec(select(Nomina).where(Nomina.id.in_(ids))).all()}


# Recupera el empleado asociado a un detalle guardado, incluso si ya no esta activo.
def obtener(session: Session, idnomina: int) -> Nomina | None:
    return session.get(Nomina, idnomina)

# Carga la tarja vigente para validar y la nomina completa solo para consultas.
def cargar_referencias(
    session: Session,
    idproyecto: int,
    *,
    contacto_id: int | None = None,
    fecha: date | None = None,
    filtrar_por_contacto: bool = True,
) -> tuple[list[NominaItem], list[NominaItem]]:
    scoped_rows: list[Nomina] = []
    if filtrar_por_contacto:
        _, scoped_rows = listar_desde_tarja(
            session,
            idproyecto,
            contacto_id=contacto_id,
            fecha=fecha,
        )
    projects = {item.id: item.nombre for item in session.exec(select(Proyecto)).all()}
    today = calendario.hoy()
    rows = session.exec(
        select(Nomina)
        .where(Nomina.activo.is_(True))
        .where(Nomina.deleted_at.is_(None))
        .where((Nomina.fecha_egreso.is_(None)) | (Nomina.fecha_egreso >= today))
        .order_by(Nomina.apellido, Nomina.nombre)
    ).all()
    row_ids = {item.id for item in rows if item.id is not None}
    base_rows = list(rows) + [
        item for item in scoped_rows if item.id is not None and item.id not in row_ids
    ]
    encargado_ids = {
        int(item.encargado_contacto_id)
        for item in base_rows
        if item.encargado_contacto_id is not None
    }
    nombres_encargados = {}
    if encargado_ids:
        contacts = session.exec(select(CRMContacto).where(CRMContacto.id.in_(encargado_ids))).all()
        nombres_encargados = {
            int(contact.id): encargados.etiqueta(contact)
            for contact in contacts
            if contact.id is not None
        }
    all_items = [
        NominaItem(
            idnomina=int(item.id),
            nombre=item.nombre,
            apellido=item.apellido,
            idproyecto=item.idproyecto,
            nombre_proyecto=projects.get(item.idproyecto),
            fuera_de_proyecto=item.idproyecto != idproyecto,
            nro_legajo=item.nro_legajo,
            encargado_contacto_id=item.encargado_contacto_id,
            encargado_nombre=(
                nombres_encargados.get(int(item.encargado_contacto_id))
                if item.encargado_contacto_id is not None and item.encargado_contacto_id != contacto_id
                else None
            ),
        )
        for item in base_rows
        if item.id is not None
    ]
    if filtrar_por_contacto:
        project_items = [
            NominaItem(
                idnomina=int(item.id),
                nombre=item.nombre,
                apellido=item.apellido,
                idproyecto=item.idproyecto,
                nombre_proyecto=projects.get(item.idproyecto),
                fuera_de_proyecto=item.idproyecto != idproyecto,
                nro_legajo=item.nro_legajo,
                encargado_contacto_id=item.encargado_contacto_id,
                encargado_nombre=None,
            )
            for item in scoped_rows
            if item.id is not None
        ]
    else:
        project_items = [item for item in all_items if item.idproyecto == idproyecto]
    return project_items, all_items


# Indica si hay empleados base que pueden inicializar la nomina de la quincena.
def _hay_nomina_base(
    session: Session,
    idproyecto: int,
    *,
    contacto_id: int | None,
    fechainicio: date,
    fechafinal: date,
) -> bool:
    query = (
        select(Nomina.id)
        .where(Nomina.idproyecto == idproyecto)
        .where(Nomina.activo.is_(True))
        .where(Nomina.deleted_at.is_(None))
        .where((Nomina.fecha_ingreso.is_(None)) | (Nomina.fecha_ingreso <= fechafinal))
        .where((Nomina.fecha_egreso.is_(None)) | (Nomina.fecha_egreso >= fechainicio))
        .limit(1)
    )
    if contacto_id is not None:
        query = query.where(Nomina.encargado_contacto_id == contacto_id)
    return session.exec(query).first() is not None


# Crea la tarja canonica y su nomina solo ante una ausencia total reparable.
def _asegurar_nomina_ausente(
    session: Session,
    idproyecto: int,
    *,
    contacto_id: int | None,
    fechainicio: date,
    fechafinal: date,
    tarja_id: int | None,
) -> int | None:
    if tarja_id is not None:
        registro_historico = session.exec(
            select(TarjaNomina.id)
            .where(TarjaNomina.tarja_id == tarja_id)
            .limit(1)
        ).first()
        if registro_historico is not None:
            # Una nomina eliminada requiere revision explicita; no se revive sola.
            return tarja_id
    if not _hay_nomina_base(
        session,
        idproyecto,
        contacto_id=contacto_id,
        fechainicio=fechainicio,
        fechafinal=fechafinal,
    ):
        return tarja_id

    # Import local para conservar empleados como dominio y evitar ciclos de modelos.
    from app.services.parte_diario_tarja_service import parte_diario_tarja_service

    tarja, created = parte_diario_tarja_service.asegurar_nomina_quincena(
        session,
        idproyecto=idproyecto,
        contacto_id=contacto_id,
        fechainicio=fechainicio,
        fechafinal=fechafinal,
    )
    logger.info(
        "Nomina de tarja inicializada defensivamente",
        extra={
            "idproyecto": idproyecto,
            "contacto_id": contacto_id,
            "tarja_id": tarja.id,
            "registros_creados": created,
        },
    )
    return int(tarja.id)


# Devuelve los empleados vigentes y autocura la ausencia total de tarja/nomina.
def listar_desde_tarja(
    session: Session,
    idproyecto: int,
    *,
    contacto_id: int | None,
    fecha: date | None,
) -> tuple[bool, list[Nomina]]:
    if fecha is None:
        return False, []
    fechainicio, fechafinal = get_quincena_range(fecha)
    contacto_filter = (
        Tarja.contacto_id == contacto_id
        if contacto_id is not None
        else Tarja.contacto_id.is_(None)
    )
    tarja_id = session.exec(
        select(Tarja.id)
        .where(Tarja.idproyecto == idproyecto)
        .where(Tarja.fechainicio == fechainicio)
        .where(Tarja.fechafinal == fechafinal)
        .where(Tarja.deleted_at.is_(None))
        .where(contacto_filter)
    ).first()
    has_registros = None
    if tarja_id is not None:
        has_registros = session.exec(
            select(TarjaNomina.id)
            .where(TarjaNomina.tarja_id == int(tarja_id))
            .where(TarjaNomina.deleted_at.is_(None))
            .limit(1)
        ).first()
    if has_registros is None:
        tarja_id = _asegurar_nomina_ausente(
            session,
            idproyecto,
            contacto_id=contacto_id,
            fechainicio=fechainicio,
            fechafinal=fechafinal,
            tarja_id=int(tarja_id) if tarja_id is not None else None,
        )
        if tarja_id is None:
            return False, []
        has_registros = session.exec(
            select(TarjaNomina.id)
            .where(TarjaNomina.tarja_id == int(tarja_id))
            .where(TarjaNomina.deleted_at.is_(None))
            .limit(1)
        ).first()
        if has_registros is None:
            return False, []
    query = (
        select(Nomina).distinct()
        .join(TarjaNomina, TarjaNomina.nomina_id == Nomina.id)
        .where(TarjaNomina.tarja_id == int(tarja_id))
        .where(TarjaNomina.deleted_at.is_(None))
        .where(TarjaNomina.fecha_desde <= fecha)
        .where(TarjaNomina.fecha_hasta >= fecha)
        .where(Nomina.deleted_at.is_(None))
        .order_by(Nomina.apellido.asc(), Nomina.nombre.asc())
    )
    return True, list(session.exec(query).all())


# Selecciona la nomina propia, de la obra o global solicitada en una consulta.
def listar_para_consulta(
    session: Session,
    idproyecto: int,
    *,
    contacto_id: int | None,
    command: str,
    alcance: str | None,
    nominas_completas: list[NominaItem],
    fecha: date | None = None,
) -> list[NominaItem]:
    if interpretacion._requests_global_nomina(command) or alcance == "global":
        return nominas_completas
    if interpretacion._requests_full_nomina(command) or alcance == "obra":
        nominas_proyecto, _ = cargar_referencias(session,
            idproyecto,
            contacto_id=contacto_id,
            fecha=fecha,
            filtrar_por_contacto=False,
        )
        return nominas_proyecto
    nominas_proyecto, _ = cargar_referencias(session,
        idproyecto,
        contacto_id=contacto_id,
        fecha=fecha,
        filtrar_por_contacto=True,
    )
    return nominas_proyecto


# Busca candidatos similares cuando el nombre del pendiente no se encontro.
def preparar_candidatos(
    pending: PendienteAmbiguo,
    nominas_proyecto: list[NominaItem],
    nominas_completas: list[NominaItem],
) -> None:
    if not pending.nombre_no_encontrado or pending.candidatos:
        return
    project_candidates, external_candidates = NominaResolver.find_similar_grouped(
        pending.nombre,
        nominas_proyecto,
        nominas_completas,
    )
    candidates = project_candidates or external_candidates
    if candidates:
        pending.candidatos = candidates
        pending.candidatos_externos = external_candidates
        pending.mostrando_candidatos_externos = not bool(project_candidates)
        pending.nombre_no_encontrado = False


# Devuelve la lista de candidatos locales o externos que esta activa.
def candidatos_activos(pending: PendienteAmbiguo) -> list[NominaItem]:
    if pending.mostrando_candidatos_externos and pending.candidatos_externos:
        return pending.candidatos_externos
    return pending.candidatos or pending.candidatos_externos or []


# Busca personas por los tokens del nombre dentro de la nomina del contexto.
def buscar_en_contexto(session: Session, proyecto_id: int, contacto_id: int | None, fecha: date | None, persona: str) -> list[Nomina]:
    needle = normalize_text(persona)
    if not needle:
        return []
    tokens = [token for token in needle.split() if token]
    nominas = listar_contexto(session, proyecto_id, contacto_id, fecha)
    return [
        item
        for item in nominas
        if all(token in normalize_text(f"{item.apellido} {item.nombre}") for token in tokens)
    ]


# Recupera exclusivamente los empleados vigentes en la tarja del contexto.
def listar_contexto(session: Session, proyecto_id: int, contacto_id: int | None, fecha: date | None) -> list[Nomina]:
    _, rows = listar_desde_tarja(session, proyecto_id, contacto_id=contacto_id, fecha=fecha)
    return rows


# Recupera todos los empleados activos, sin limitar la consulta a una obra.
def listar_activas(session: Session) -> list[Nomina]:
    return session.exec(
        select(Nomina)
        .where(Nomina.activo.is_(True))
        .where(Nomina.deleted_at.is_(None))
        .order_by(Nomina.apellido.asc(), Nomina.nombre.asc())
    ).all()

# endregion
