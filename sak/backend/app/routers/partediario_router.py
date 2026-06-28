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

parte_diario_crud = NestedCRUD(
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
    session: Session = Depends(get_session),
):
    empleados = session.exec(
        select(Nomina)
        .where(
            Nomina.idproyecto == idproyecto,
            Nomina.activo.is_(True),
            Nomina.deleted_at.is_(None),
        )
        .order_by(Nomina.apellido, Nomina.nombre)
    ).all()

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


@parte_diario_router.post("/{parte_id}/cerrar")
def cerrar_parte_diario(
    parte_id: int,
    session: Session = Depends(get_session),
):
    try:
        parte = parte_diario_tarja_service.cerrar_parte(session, parte_id)
        return filtrar_respuesta(parte)
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
