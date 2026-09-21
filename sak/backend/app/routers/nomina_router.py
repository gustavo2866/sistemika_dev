import json
from typing import Any

from fastapi import Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session
from app.models.nomina import Nomina
from app.models.proyecto import Proyecto
from app.models.proyecto_encargado import ProyectoEncargado
from app.models.tarja import TarjaNomina
from app.models.crm.catalogos import CRMTipoContacto
from app.models.crm.contacto import CRMContacto


class NominaAsignarEncargadoRequest(BaseModel):
    nomina_ids: list[int] = Field(min_length=1)
    proyecto_id: int = Field(gt=0)
    contacto_id: int = Field(gt=0)


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

    @staticmethod
    def asegurar_relacion_proyecto_encargado(
        session: Session,
        proyecto_id: int | None,
        contacto_id: int | None,
    ) -> bool:
        if proyecto_id is None or contacto_id is None:
            return False
        relacion_id = session.exec(
            select(ProyectoEncargado.id)
            .where(ProyectoEncargado.proyecto_id == int(proyecto_id))
            .where(ProyectoEncargado.contacto_id == int(contacto_id))
            .where(ProyectoEncargado.deleted_at.is_(None))
            .limit(1)
        ).first()
        if relacion_id is not None:
            return False
        session.add(
            ProyectoEncargado(
                proyecto_id=int(proyecto_id),
                contacto_id=int(contacto_id),
                principal=False,
                activo=True,
            )
        )
        return True

    def create(self, session: Session, data: dict[str, Any], auto_commit: bool = True) -> Nomina:
        self._validate_active_dni_available(session, data)
        empleado = super().create(session, data, auto_commit=False)
        self.asegurar_relacion_proyecto_encargado(
            session,
            empleado.idproyecto,
            empleado.encargado_contacto_id,
        )
        if auto_commit:
            session.commit()
            session.refresh(empleado)
        else:
            session.flush()
        return empleado

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
        empleado = super().update(
            session,
            obj_id,
            data,
            check_version=check_version,
            auto_commit=False,
        )
        if empleado is None:
            return None
        self.asegurar_relacion_proyecto_encargado(
            session,
            empleado.idproyecto,
            empleado.encargado_contacto_id,
        )
        if auto_commit:
            session.commit()
            session.refresh(empleado)
        else:
            session.flush()
        return empleado

    def delete(self, session: Session, obj_id: Any, hard: bool = False) -> bool:
        tarja_nomina_id = session.exec(
            select(TarjaNomina.id)
            .where(TarjaNomina.nomina_id == int(obj_id))
            .where(TarjaNomina.deleted_at.is_(None))
            .limit(1)
        ).first()
        if tarja_nomina_id is not None:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "No se puede eliminar el empleado porque pertenece a una Tarja Nomina.",
                        "details": {"nomina_id": int(obj_id)},
                    }
                },
            )
        return super().delete(session, obj_id, hard=hard)


# CRUD generico para Nomina, con disponibilidad resuelta desde la asignacion vigente.
nomina_crud = NominaCRUD(Nomina)

# Router generico siguiendo el patron existente
nomina_router = create_generic_router(
    model=Nomina,
    crud=nomina_crud,
    prefix="/nominas",
    tags=["nominas"],
)


@nomina_router.post("/asignar-encargado")
def asignar_encargado_a_nomina(
    payload: NominaAsignarEncargadoRequest,
    session: Session = Depends(get_session),
):
    proyecto = session.exec(
        select(Proyecto)
        .where(Proyecto.id == payload.proyecto_id)
        .where(Proyecto.deleted_at.is_(None))
    ).first()
    if proyecto is None:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "El proyecto seleccionado no existe o fue eliminado.",
                    "details": {"proyecto_id": payload.proyecto_id},
                }
            },
        )

    contacto = session.exec(
        select(CRMContacto)
        .join(CRMTipoContacto, CRMTipoContacto.id == CRMContacto.tipo_id)
        .where(CRMContacto.id == payload.contacto_id)
        .where(CRMContacto.deleted_at.is_(None))
        .where(CRMTipoContacto.nombre == "Encargado")
        .where(CRMTipoContacto.activo.is_(True))
    ).first()
    if contacto is None:
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "El contacto seleccionado no es un encargado activo.",
                    "details": {"contacto_id": payload.contacto_id},
                }
            },
        )

    nomina_ids = list(dict.fromkeys(payload.nomina_ids))
    empleados = list(
        session.exec(
            select(Nomina)
            .where(Nomina.id.in_(nomina_ids))
            .where(Nomina.deleted_at.is_(None))
        ).all()
    )
    if len(empleados) != len(nomina_ids):
        encontrados = {int(item.id) for item in empleados if item.id is not None}
        faltantes = [item_id for item_id in nomina_ids if item_id not in encontrados]
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Uno o mas empleados seleccionados no existen o fueron eliminados.",
                    "details": {"nomina_ids": faltantes},
                }
            },
        )

    for empleado in empleados:
        empleado.idproyecto = payload.proyecto_id
        empleado.encargado_contacto_id = payload.contacto_id
        session.add(empleado)

    relaciones_creadas = int(
        nomina_crud.asegurar_relacion_proyecto_encargado(
            session,
            payload.proyecto_id,
            payload.contacto_id,
        )
    )

    session.commit()
    return {
        "id": payload.contacto_id,
        "empleados_actualizados": len(empleados),
        "relaciones_creadas": relaciones_creadas,
    }


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
