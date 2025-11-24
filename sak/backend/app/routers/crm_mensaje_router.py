from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session

from app.core.router import create_generic_router
from app.crud.crm_mensaje_crud import crm_mensaje_crud
from app.db import get_session
from app.models import CRMMensaje
from app.services.crm_mensaje_service import crm_mensaje_service


router = create_generic_router(
    model=CRMMensaje,
    crud=crm_mensaje_crud,
    prefix="/crm/mensajes",
    tags=["crm-mensajes"],
)


@router.post("/entrada")
def crear_mensaje_entrada(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    """Alias de create que fuerza tipo=entrada y estado=nuevo."""
    data = {"tipo": "entrada", "estado": "nuevo", **payload}
    try:
        mensaje = crm_mensaje_crud.create(session, data)
        return mensaje
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{mensaje_id}/confirmar")
def confirmar_mensaje(
    mensaje_id: int,
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    try:
        mensaje = crm_mensaje_service.confirmar(session, mensaje_id, payload)
        return mensaje
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{mensaje_id}/reintentar")
def reintentar_mensaje(
    mensaje_id: int,
    session: Session = Depends(get_session),
):
    try:
        mensaje = crm_mensaje_service.reintentar_salida(session, mensaje_id)
        return mensaje
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{mensaje_id}/llm-sugerir")
def sugerir_mensaje_llm(
    mensaje_id: int,
    payload: dict = Body({}, description="Opcional: {'force': true} para refrescar"),
    session: Session = Depends(get_session),
):
    force = bool(payload.get("force")) if isinstance(payload, dict) else False
    try:
        suggestions = crm_mensaje_service.sugerir_llm(session, mensaje_id, force=force)
        return {"llm_suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
