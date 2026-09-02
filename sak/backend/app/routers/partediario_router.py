from typing import Any

from app.core.nested_crud import NestedCRUD
from app.models.base import filtrar_respuesta
from app.core.router import create_generic_router
from app.db import get_session
from app.models.nomina import Nomina
from app.models.partediario import ParteDiario, ParteDiarioDetalle
from app.services.parte_diario_tarja_service import parte_diario_tarja_service
from fastapi import Depends, HTTPException, Query
from sqlmodel import Session, select

# Define NestedCRUD for ParteDiario with its nested detalles

class ParteDiarioCRUD(NestedCRUD):
    def _validate_nomina_detalles(
        self,
        session: Session,
        data: dict[str, Any],
        *,
        existing: ParteDiario | None = None,
    ) -> None:
        detalles = data.get("detalles")
        if not isinstance(detalles, list):
            return

        idproyecto = data.get("idproyecto", existing.idproyecto if existing is not None else None)
        contacto_id = data.get("contacto_id", existing.contacto_id if existing is not None else None)
        if idproyecto in (None, ""):
            return

        proyecto_id = int(idproyecto)
        encargado_id = None if contacto_id in (None, "") else int(contacto_id)
        nomina_ids = {
            int(detalle["idnomina"])
            for detalle in detalles
            if isinstance(detalle, dict) and detalle.get("idnomina") not in (None, "")
        }
        if not nomina_ids:
            return

        stmt = (
            select(Nomina.id)
            .where(Nomina.id.in_(nomina_ids))
            .where(Nomina.idproyecto == proyecto_id)
            .where(Nomina.activo.is_(True))
            .where(Nomina.deleted_at.is_(None))
        )
        if encargado_id is not None:
            stmt = stmt.where(Nomina.encargado_contacto_id == encargado_id)

        valid_ids = {int(nomina_id) for nomina_id in session.exec(stmt).all()}
        invalid_ids = sorted(nomina_ids - valid_ids)
        if invalid_ids:
            raise ValueError(
                "La nomina seleccionada no corresponde al proyecto y encargado del parte diario: "
                + ", ".join(str(nomina_id) for nomina_id in invalid_ids)
            )

    def create(self, session: Session, data: dict[str, Any]):
        self._validate_nomina_detalles(session, data)
        return super().create(session, data)

    def update(
        self,
        session: Session,
        obj_id: Any,
        data: dict[str, Any],
        check_version: bool = True,
    ):
        existing = session.get(ParteDiario, obj_id)
        self._validate_nomina_detalles(session, data, existing=existing)
        return super().update(session, obj_id, data, check_version=check_version)


parte_diario_crud = ParteDiarioCRUD(
    ParteDiario,
    nested_relations={
        "detalles": {
            "model": ParteDiarioDetalle,
            "fk_field": "parte_diario_id",
            "allow_delete": True,
        }
    },
)

parte_diario_router = create_generic_router(
    model=ParteDiario,
    crud=parte_diario_crud,
    prefix="/parte-diario",
    tags=["parte-diario"],
)


@parte_diario_router.get("/detalles-nomina")
def get_detalles_nomina_proyecto(
    idproyecto: int = Query(..., gt=0),
    contacto_id: int | None = Query(default=None, gt=0),
    session: Session = Depends(get_session),
):
    stmt = (
        select(Nomina)
        .where(
            Nomina.idproyecto == idproyecto,
            Nomina.activo.is_(True),
            Nomina.deleted_at.is_(None),
        )
        .order_by(Nomina.apellido, Nomina.nombre)
    )
    if contacto_id is not None:
        stmt = stmt.where(Nomina.encargado_contacto_id == contacto_id)

    empleados = session.exec(stmt).all()

    return {
        "data": [
            {
                "idnomina": empleado.id,
                "nombre_provisorio": None,
                "horas": 8,
                "idestado": None,
                "ingreso": None,
                "egreso": None,
                "descripcion": None,
                "nomina": {
                    "id": empleado.id,
                    "nombre": empleado.nombre,
                    "apellido": empleado.apellido,
                    "dni": empleado.dni,
                },
            }
            for empleado in empleados
        ],
        "total": len(empleados),
    }


@parte_diario_router.post("/{parte_id}/abrir")
def abrir_parte_diario(
    parte_id: int,
    session: Session = Depends(get_session),
):
    try:
        parte = parte_diario_tarja_service.abrir_parte(session, parte_id)
        return filtrar_respuesta(parte)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@parte_diario_router.post("/{parte_id}/confirmar")
def confirmar_parte_diario(
    parte_id: int,
    session: Session = Depends(get_session),
):
    try:
        parte = parte_diario_tarja_service.confirmar_parte(session, parte_id)
        return filtrar_respuesta(parte)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@parte_diario_router.post("/{parte_id}/cerrar")
def cerrar_parte_diario(
    parte_id: int,
    session: Session = Depends(get_session),
):
    try:
        tarja = parte_diario_tarja_service.cerrar_parte(session, parte_id)
        return filtrar_respuesta(tarja)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@parte_diario_router.post("/{parte_id}/registrar-tarja")
def registrar_tarja_desde_parte_diario(
    parte_id: int,
    session: Session = Depends(get_session),
):
    try:
        tarja = parte_diario_tarja_service.registrar_tarja(session, parte_id)
        return filtrar_respuesta(tarja)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@parte_diario_router.get("/{parte_id}/tarja")
def get_tarja_de_parte_diario(
    parte_id: int,
    session: Session = Depends(get_session),
):
    try:
        tarja = parte_diario_tarja_service.get_tarja_para_parte(session, parte_id)
        return {
            "exists": tarja is not None,
            "tarja_id": tarja.id if tarja is not None else None,
            "estado": tarja.estado if tarja is not None else None,
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
