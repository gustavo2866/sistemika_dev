from datetime import date, timedelta

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlmodel import Session
from sqlmodel import select

from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.base import filtrar_respuesta
from app.models.crm.contacto import CRMContacto
from app.models.partediario import EstadoParteDiario, ParteDiario
from app.models.proyecto import Proyecto
from app.models.proyecto_encargado import ProyectoEncargado
from app.models.tarja import Tarja, TarjaDetalle, TarjaNovedad
from app.services.parte_diario_tarja_service import parte_diario_tarja_service


class GenerarTarjaRequest(BaseModel):
    idproyecto: int = Field(..., gt=0)
    fechainicio: date
    fechafinal: date
    contacto_id: int | None = Field(default=None, gt=0)


DEFAULT_PROJECT_ESTADO = "02-ejecucion"

tarja_crud = NestedCRUD(
    Tarja,
    nested_relations={
        "detalles": {
            "model": TarjaDetalle,
            "fk_field": "tarja_id",
            "allow_delete": True,
        },
        "novedades": {
            "model": TarjaNovedad,
            "fk_field": "tarja_id",
            "allow_delete": True,
        },
    },
)

tarja_router = create_generic_router(
    model=Tarja,
    crud=tarja_crud,
    prefix="/tarjas",
    tags=["tarjas"],
)


def _iter_dates(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def _project_is_active_in_range(project, start: date, end: date) -> bool:
    if project.fecha_inicio and project.fecha_inicio > end:
        return False
    if project.fecha_final and project.fecha_final < start:
        return False
    return True


def _project_expected_on_date(project, day: date) -> bool:
    if day.weekday() == 6:
        return False
    if project.fecha_inicio and project.fecha_inicio > day:
        return False
    if project.fecha_final and project.fecha_final < day:
        return False
    return True


def _build_part_day(day: date, partes: list[ParteDiario], expected: bool) -> dict:
    if not expected:
        status = "descanso"
    elif not partes:
        status = "faltante"
    elif any(parte.estado == EstadoParteDiario.BORRADOR for parte in partes):
        status = "borrador"
    elif all(parte.estado == EstadoParteDiario.CERRADO for parte in partes):
        status = "cerrado"
    else:
        status = "completo"

    return {
        "fecha": day.isoformat(),
        "dia": day.day,
        "weekday": day.weekday(),
        "esperado": expected,
        "estado": status,
        "parte_ids": [parte.id for parte in partes if parte.id is not None],
        "partes": len(partes),
    }


def _add_encargado_option(
    encargados_by_project: dict[int, list[dict]],
    *,
    proyecto_id: int,
    contacto_id: int,
    nombre: str | None,
    principal: bool,
) -> None:
    encargados = encargados_by_project.setdefault(proyecto_id, [])
    existing = next(
        (encargado for encargado in encargados if encargado["contacto_id"] == contacto_id),
        None,
    )
    if existing is not None:
        existing["principal"] = bool(existing["principal"] or principal)
        if nombre and not existing.get("nombre"):
            existing["nombre"] = nombre
        return
    encargados.append(
        {
            "contacto_id": contacto_id,
            "nombre": nombre,
            "principal": principal,
        }
    )


@tarja_router.get("/panel")
def get_tarja_panel(
    fechainicio: date = Query(...),
    fechafinal: date = Query(...),
    idproyecto: int | None = Query(default=None, gt=0),
    estado: str | None = Query(default=DEFAULT_PROJECT_ESTADO),
    session: Session = Depends(get_session),
):
    project_stmt = (
        select(Proyecto)
        .where(Proyecto.deleted_at.is_(None))
        .order_by(Proyecto.nombre)
    )
    estado = estado.strip() if estado else None
    if estado:
        project_stmt = project_stmt.where(Proyecto.estado == estado)
    if idproyecto:
        project_stmt = project_stmt.where(Proyecto.id == idproyecto)

    projects = [
        project
        for project in session.exec(project_stmt).all()
        if _project_is_active_in_range(project, fechainicio, fechafinal)
    ]
    project_ids = [project.id for project in projects if project.id is not None]

    partes_by_project_contact_day: dict[tuple[int, int | None, date], list[ParteDiario]] = {}
    tarjas_by_project_contact: dict[tuple[int, int | None], list[Tarja]] = {}
    encargados_by_project: dict[int, list[dict]] = {}
    detalle_stats_by_tarja: dict[int, dict] = {}
    novedad_stats_by_tarja: dict[int, dict] = {}

    if project_ids:
        parte_stmt = (
            select(ParteDiario)
            .where(ParteDiario.idproyecto.in_(project_ids))
            .where(ParteDiario.fecha >= fechainicio)
            .where(ParteDiario.fecha <= fechafinal)
            .where(ParteDiario.deleted_at.is_(None))
        )
        for parte in session.exec(parte_stmt).all():
            if parte.idproyecto is None or parte.fecha is None:
                continue
            key = (int(parte.idproyecto), parte.contacto_id, parte.fecha)
            partes_by_project_contact_day.setdefault(key, []).append(parte)

        tarja_stmt = (
            select(Tarja)
            .where(Tarja.idproyecto.in_(project_ids))
            .where(Tarja.fechainicio <= fechafinal)
            .where(Tarja.fechafinal >= fechainicio)
            .where(Tarja.deleted_at.is_(None))
            .order_by(Tarja.id.desc())
        )
        tarjas = session.exec(tarja_stmt).all()
        for tarja in tarjas:
            if tarja.idproyecto is not None:
                key = (int(tarja.idproyecto), tarja.contacto_id)
                tarjas_by_project_contact.setdefault(key, []).append(tarja)

        tarja_ids = [tarja.id for tarja in tarjas if tarja.id is not None]
        if tarja_ids:
            detalle_rows = session.exec(
                select(
                    TarjaDetalle.tarja_id,
                    func.count(TarjaDetalle.id),
                    func.coalesce(func.sum(TarjaDetalle.horas), 0),
                )
                .where(TarjaDetalle.tarja_id.in_(tarja_ids))
                .where(TarjaDetalle.deleted_at.is_(None))
                .group_by(TarjaDetalle.tarja_id)
            ).all()
            detalle_stats_by_tarja = {
                int(tarja_id): {"registros": int(registros or 0), "horas": float(horas or 0)}
                for tarja_id, registros, horas in detalle_rows
            }

            novedad_rows = session.exec(
                select(
                    TarjaNovedad.tarja_id,
                    func.count(TarjaNovedad.id),
                    func.coalesce(func.sum(TarjaNovedad.adicional), 0),
                    func.coalesce(func.sum(TarjaNovedad.premio), 0),
                )
                .where(TarjaNovedad.tarja_id.in_(tarja_ids))
                .where(TarjaNovedad.deleted_at.is_(None))
                .group_by(TarjaNovedad.tarja_id)
            ).all()
            novedad_stats_by_tarja = {
                int(tarja_id): {
                    "novedades": int(novedades or 0),
                    "adicional": float(adicional or 0),
                    "premio": float(premio or 0),
                }
                for tarja_id, novedades, adicional, premio in novedad_rows
            }

        encargado_stmt = (
            select(ProyectoEncargado)
            .where(ProyectoEncargado.proyecto_id.in_(project_ids))
            .where(ProyectoEncargado.activo.is_(True))
            .where(ProyectoEncargado.deleted_at.is_(None))
            .order_by(ProyectoEncargado.principal.desc(), ProyectoEncargado.id)
        )
        encargados = session.exec(encargado_stmt).all()
        contacto_ids = [int(encargado.contacto_id) for encargado in encargados if encargado.contacto_id]
        contactos_by_id = {}
        if contacto_ids:
            contactos = session.exec(
                select(CRMContacto)
                .where(CRMContacto.id.in_(contacto_ids))
                .where(CRMContacto.deleted_at.is_(None))
            ).all()
            contactos_by_id = {int(contacto.id): contacto for contacto in contactos if contacto.id is not None}
        for encargado in encargados:
            contacto_id = int(encargado.contacto_id)
            contacto = contactos_by_id.get(contacto_id)
            _add_encargado_option(
                encargados_by_project,
                proyecto_id=int(encargado.proyecto_id),
                contacto_id=contacto_id,
                nombre=contacto.nombre_completo if contacto is not None else f"Contacto #{contacto_id}",
                principal=bool(encargado.principal),
            )

    rows = []
    totals = {
        "obras": 0,
        "dias_esperados": 0,
        "partes_completos": 0,
        "partes_borrador": 0,
        "partes_faltantes": 0,
        "sin_tarja": 0,
        "tarjas_borrador": 0,
        "tarjas_listas": 0,
        "tarjas_cerradas": 0,
    }

    for project in projects:
        project_id = int(project.id)
        encargados = encargados_by_project.get(project_id, [])
        contactos_existentes = {
            contacto_id
            for tarja_project_id, contacto_id in tarjas_by_project_contact.keys()
            if tarja_project_id == project_id
        } | {
            contacto_id
            for tarja_project_id, contacto_id, _day in partes_by_project_contact_day.keys()
            if tarja_project_id == project_id
        }
        contactos_con_fila = {encargado["contacto_id"] for encargado in encargados}
        for contacto_id in sorted(
            contacto for contacto in contactos_existentes if contacto not in contactos_con_fila and contacto is not None
        ):
            contacto = session.get(CRMContacto, contacto_id)
            if contacto is None or contacto.deleted_at is not None:
                continue
            encargados.append(
                {
                    "contacto_id": contacto_id,
                    "nombre": contacto.nombre_completo,
                    "principal": False,
                }
            )
        if not encargados:
            encargados = [{"contacto_id": None, "nombre": None, "principal": True}]

        for encargado in encargados:
            contacto_id = encargado["contacto_id"]
            days = []
            stats = {
                "esperados": 0,
                "completos": 0,
                "borrador": 0,
                "faltantes": 0,
                "descanso": 0,
            }
            for day in _iter_dates(fechainicio, fechafinal):
                expected = _project_expected_on_date(project, day)
                part_day = _build_part_day(
                    day,
                    partes_by_project_contact_day.get((project_id, contacto_id, day), []),
                    expected,
                )
                days.append(part_day)
                if expected:
                    stats["esperados"] += 1
                if part_day["estado"] in {"completo", "cerrado"}:
                    stats["completos"] += 1
                elif part_day["estado"] == "borrador":
                    stats["borrador"] += 1
                elif part_day["estado"] == "faltante":
                    stats["faltantes"] += 1
                elif part_day["estado"] == "descanso":
                    stats["descanso"] += 1

            project_tarjas = tarjas_by_project_contact.get((project_id, contacto_id), [])
            selected_tarja = next((tarja for tarja in project_tarjas if tarja.estado == "borrador"), None)
            if selected_tarja is None and project_tarjas:
                selected_tarja = project_tarjas[0]

            tarja_payload = None
            if selected_tarja and selected_tarja.id is not None:
                detalle_stats = detalle_stats_by_tarja.get(int(selected_tarja.id), {})
                novedad_stats = novedad_stats_by_tarja.get(int(selected_tarja.id), {})
                lista_para_cerrar = (
                    selected_tarja.estado == "borrador"
                    and stats["faltantes"] == 0
                    and stats["borrador"] == 0
                )
                tarja_payload = {
                    "id": selected_tarja.id,
                    "estado": selected_tarja.estado,
                    "panel_estado": "lista_cerrar" if lista_para_cerrar else selected_tarja.estado,
                    "fechainicio": selected_tarja.fechainicio.isoformat() if selected_tarja.fechainicio else None,
                    "fechafinal": selected_tarja.fechafinal.isoformat() if selected_tarja.fechafinal else None,
                    "registros": detalle_stats.get("registros", 0),
                    "horas": detalle_stats.get("horas", 0),
                    "novedades": novedad_stats.get("novedades", 0),
                    "adicional": novedad_stats.get("adicional", 0),
                    "premio": novedad_stats.get("premio", 0),
                }

            if tarja_payload is None:
                totals["sin_tarja"] += 1
            elif tarja_payload["estado"] == "cerrado":
                totals["tarjas_cerradas"] += 1
            elif tarja_payload["panel_estado"] == "lista_cerrar":
                totals["tarjas_listas"] += 1
            else:
                totals["tarjas_borrador"] += 1

            totals["obras"] += 1
            totals["dias_esperados"] += stats["esperados"]
            totals["partes_completos"] += stats["completos"]
            totals["partes_borrador"] += stats["borrador"]
            totals["partes_faltantes"] += stats["faltantes"]
            partes_completos_para_generar = (
                stats["esperados"] > 0
                and stats["faltantes"] == 0
                and stats["borrador"] == 0
            )

            rows.append(
                {
                    "id": f"{project_id}:{contacto_id or 'sin-encargado'}",
                    "proyecto_id": project_id,
                    "contacto_id": contacto_id,
                    "proyecto_nombre": project.nombre,
                    "proyecto_estado": project.estado,
                    "encargado": encargado["nombre"],
                    "encargado_principal": encargado["principal"],
                    "fecha_inicio": project.fecha_inicio.isoformat() if project.fecha_inicio else None,
                    "fecha_final": project.fecha_final.isoformat() if project.fecha_final else None,
                    "dias": days,
                    "parte_stats": stats,
                    "tarja": tarja_payload,
                    "puede_generar": partes_completos_para_generar
                    and (tarja_payload is None or tarja_payload["estado"] == "borrador"),
                    "puede_cerrar": bool(tarja_payload and tarja_payload["panel_estado"] == "lista_cerrar"),
                    "puede_reabrir": bool(tarja_payload and tarja_payload["estado"] == "cerrado"),
                }
            )

    return {
        "range": {
            "fechainicio": fechainicio.isoformat(),
            "fechafinal": fechafinal.isoformat(),
        },
        "totals": totals,
        "rows": rows,
    }


@tarja_router.post("/generar")
def generar_tarja(
    payload: GenerarTarjaRequest,
    session: Session = Depends(get_session),
):
    try:
        tarja = parte_diario_tarja_service.generar_tarja_desde_panel(
            session,
            idproyecto=payload.idproyecto,
            fechainicio=payload.fechainicio,
            fechafinal=payload.fechafinal,
            contacto_id=payload.contacto_id,
        )
        return filtrar_respuesta(tarja)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
