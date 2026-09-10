import json
from typing import Any

from fastapi import Depends, HTTPException, Query, Response
from sqlmodel import Session, select

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.nomina import Nomina
from app.models.proyecto import Proyecto


class NominaCRUD(GenericCRUD[Nomina]):
    DUPLICATE_ACTIVE_DNI_MESSAGE = "Ya existe un empleado activo con ese DNI"

    @staticmethod
    def _normalize_dni(value: Any) -> str:
        return str(value or "").strip()

    def _validate_active_dni_available(
        self,
        session: Session,
        data: dict[str, Any],
        *,
        exclude_id: int | None = None,
    ) -> None:
        dni = self._normalize_dni(data.get("dni"))
        if not dni:
            return
        activo = data.get("activo", True)
        if activo is False or str(activo).strip().lower() in {"0", "false", "no", "off"}:
            return

        stmt = (
            select(Nomina.id)
            .where(Nomina.dni == dni)
            .where(Nomina.activo.is_(True))
            .where(Nomina.deleted_at.is_(None))
        )
        if exclude_id is not None:
            stmt = stmt.where(Nomina.id != exclude_id)
        existing_id = session.exec(stmt).first()
        if existing_id is not None:
            raise ValueError(f"{self.DUPLICATE_ACTIVE_DNI_MESSAGE}: {dni}")

    def _apply_filters(self, stmt, filters):
        remaining_filters = dict(filters)
        solo_sin_proyecto = str(
            remaining_filters.pop("sin_proyecto", "")
        ).strip().lower() in {"1", "true", "si", "sí"}
        if solo_sin_proyecto:
            stmt = stmt.where(Nomina.idproyecto.is_(None))
        return super()._apply_filters(stmt, remaining_filters)


    def create(self, session: Session, data: dict[str, Any], auto_commit: bool = True) -> Nomina:
        self._validate_active_dni_available(session, data)
        return super().create(session, data, auto_commit=auto_commit)

    def update(
        self,
        session: Session,
        obj_id: Any,
        data: dict[str, Any],
        check_version: bool = True,
        auto_commit: bool = True,
    ) -> Nomina | None:
        existing = self.get(session, obj_id)
        if existing is None:
            return None
        self._validate_active_dni_available(
            session,
            {
                "dni": data.get("dni", existing.dni),
                "activo": data.get("activo", existing.activo),
            },
            exclude_id=int(existing.id),
        )
        return super().update(
            session,
            obj_id,
            data,
            check_version=check_version,
            auto_commit=auto_commit,
        )


# CRUD generico para Nomina, con disponibilidad resuelta desde la asignacion vigente.
nomina_crud = NominaCRUD(Nomina)

# Router generico siguiendo el patron existente
nomina_router = create_generic_router(
    model=Nomina,
    crud=nomina_crud,
    prefix="/nominas",
    tags=["nominas"],
)


@nomina_router.get("/proyectos")
def list_proyectos_con_nomina(
    response: Response,
    session: Session = Depends(get_session),
    sort: str | None = Query(None),
    range: str | None = Query(None),
    filter: str | None = Query(None),
    q: str | None = Query(None),
):
    """Opciones de obras para filtros de nomina: solo proyectos con nomina asignada."""
    start, end = _parse_range(range)
    sort_field, sort_order = _parse_sort(sort)
    filters = _parse_filter(filter)

    stmt = (
        select(Proyecto.id, Proyecto.nombre)
        .join(Nomina, Nomina.idproyecto == Proyecto.id)
        .where(Nomina.deleted_at.is_(None))
        .where(Proyecto.deleted_at.is_(None))
        .group_by(Proyecto.id, Proyecto.nombre)
    )
    if q:
        stmt = stmt.where(Proyecto.nombre.ilike(f"%{q}%"))
    id_filter = filters.get("id")
    if isinstance(id_filter, list):
        stmt = stmt.where(Proyecto.id.in_([int(item) for item in id_filter if str(item).isdigit()]))
    elif str(id_filter or "").isdigit():
        stmt = stmt.where(Proyecto.id == int(id_filter))

    rows = list(session.exec(stmt).all())
    total = len(rows)
    reverse = sort_order == "desc"
    if sort_field == "id":
        rows.sort(key=lambda row: int(row[0] or 0), reverse=reverse)
    else:
        rows.sort(key=lambda row: str(row[1] or "").lower(), reverse=reverse)

    paged = rows[start : end + 1]
    last = start + len(paged) - 1 if paged else start
    response.headers["Content-Range"] = f"items {start}-{last}/{total}"
    return [{"id": row[0], "nombre": row[1]} for row in paged]


@nomina_router.get("/proyectos/{proyecto_id:int}")
def get_proyecto_con_nomina(
    proyecto_id: int,
    session: Session = Depends(get_session),
):
    stmt = (
        select(Proyecto.id, Proyecto.nombre)
        .join(Nomina, Nomina.idproyecto == Proyecto.id)
        .where(Proyecto.id == proyecto_id)
        .where(Nomina.deleted_at.is_(None))
        .where(Proyecto.deleted_at.is_(None))
        .group_by(Proyecto.id, Proyecto.nombre)
    )
    row = session.exec(stmt).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Proyecto sin nomina asignada")
    return {"id": row[0], "nombre": row[1]}


def _parse_range(value: str | None) -> tuple[int, int]:
    if not value:
        return 0, 99
    try:
        parsed = json.loads(value)
        return max(int(parsed[0]), 0), max(int(parsed[1]), 0)
    except Exception:
        return 0, 99


def _parse_sort(value: str | None) -> tuple[str, str]:
    if not value:
        return "nombre", "asc"
    try:
        parsed = json.loads(value)
        field = str(parsed[0] or "nombre")
        order = str(parsed[1] or "ASC").lower()
        return ("id" if field == "id" else "nombre"), ("desc" if order == "desc" else "asc")
    except Exception:
        return "nombre", "asc"


def _parse_filter(value: str | None) -> dict:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}
