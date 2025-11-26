"""
Endpoints para gestion de contactos.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import Contacto, Empresa
from app.schemas import ContactoCreate, ContactoRead

router = APIRouter(prefix="/contactos", tags=["Contactos"])


@router.get("/", response_model=List[ContactoRead])
def listar_contactos(
    empresa_id: UUID = Query(...),
    search: Optional[str] = Query(None, description="Filtra por nombre o telefono"),
    session: Session = Depends(get_session),
):
    query = select(Contacto).where(Contacto.empresa_id == empresa_id)
    if search:
        pattern = f"%{search}%"
        query = query.where((Contacto.nombre.ilike(pattern)) | (Contacto.telefono.ilike(pattern)))
    contactos = session.exec(query).all()
    return contactos


@router.post("/", response_model=ContactoRead, status_code=status.HTTP_201_CREATED)
def crear_contacto(payload: ContactoCreate, session: Session = Depends(get_session)):
    empresa = session.get(Empresa, payload.empresa_id)
    if not empresa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")
    contacto = Contacto(**payload.model_dump())
    session.add(contacto)
    session.commit()
    session.refresh(contacto)
    return contacto
