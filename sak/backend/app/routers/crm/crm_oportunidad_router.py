from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session, select

from app.core.router import create_generic_router
from app.db import get_session
from app.models import CRMOportunidad, CRMOportunidadLogEstado
from app.crud.crm_oportunidad_crud import crm_oportunidad_crud
from app.services.crm_oportunidad_service import crm_oportunidad_service
from app.models.base import filtrar_respuesta


crm_oportunidad_router = create_generic_router(
    model=CRMOportunidad,
    crud=crm_oportunidad_crud,
    prefix="/crm/oportunidades",
    tags=["crm-oportunidades"],
)


@crm_oportunidad_router.post("/{oportunidad_id}/cambiar-estado")
def cambiar_estado(
    oportunidad_id: int,
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    try:
        nuevo_estado = payload.get("nuevo_estado")
        descripcion = payload.get("descripcion", "")
        if not nuevo_estado or not descripcion:
            raise ValueError("nuevo_estado y descripcion son obligatorios")
        usuario_id = payload.get("usuario_id") or 1
        oportunidad = crm_oportunidad_service.cambiar_estado(
            session=session,
            oportunidad_id=oportunidad_id,
            nuevo_estado=nuevo_estado,
            descripcion=descripcion,
            usuario_id=usuario_id,
            fecha_estado=payload.get("fecha_estado"),
            motivo_perdida_id=payload.get("motivo_perdida_id"),
            monto=payload.get("monto"),
            moneda_id=payload.get("moneda_id"),
            condicion_pago_id=payload.get("condicion_pago_id"),
        )
        return filtrar_respuesta(oportunidad)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@crm_oportunidad_router.get("/{oportunidad_id}/logs")
def listar_logs(
    oportunidad_id: int,
    session: Session = Depends(get_session),
):
    logs = session.exec(
        select(CRMOportunidadLogEstado).where(
            CRMOportunidadLogEstado.oportunidad_id == oportunidad_id
        )
    ).all()
    return [log.model_dump() for log in logs]
