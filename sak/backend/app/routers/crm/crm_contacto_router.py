from fastapi import Body, Depends, HTTPException
from sqlmodel import Session

from app.core.router import create_generic_router
from app.db import get_session
from app.models import CRMContacto
from app.crud.crm_contacto_crud import crm_contacto_crud
from app.services.crm_contacto_service import crm_contacto_service
from app.models.base import filtrar_respuesta


crm_contacto_router = create_generic_router(
    model=CRMContacto,
    crud=crm_contacto_crud,
    prefix="/crm/contactos",
    tags=["crm-contactos"],
)


@crm_contacto_router.post("/buscar")
def buscar_contacto(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    email = payload.get("email")
    telefono = payload.get("telefono")
    contacto = crm_contacto_service.buscar(session, email, telefono)
    if not contacto:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    return filtrar_respuesta(contacto)
