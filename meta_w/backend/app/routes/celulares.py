"""
Endpoints para gestion de celulares y phone numbers de Meta.
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import Celular, Empresa
from app.schemas import CelularCreate, CelularRead

router = APIRouter(prefix="/celulares", tags=["Celulares"])


@router.get("/", response_model=List[CelularRead])
def listar_celulares(
    empresa_id: UUID = Query(...),
    estado: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    query = select(Celular).where(Celular.empresa_id == empresa_id)
    if estado:
        query = query.where(Celular.estado == estado)
    celulares = session.exec(query).all()
    return celulares


@router.post("/", response_model=CelularRead, status_code=status.HTTP_201_CREATED)
def crear_celular(payload: CelularCreate, session: Session = Depends(get_session)):
    empresa = session.get(Empresa, payload.empresa_id)
    if not empresa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")
    celular = Celular(**payload.model_dump())
    session.add(celular)
    session.commit()
    session.refresh(celular)
    return celular
