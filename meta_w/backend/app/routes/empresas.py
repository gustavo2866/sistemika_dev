"""
Endpoints para gestion de empresas.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import Empresa
from app.schemas import EmpresaCreate, EmpresaRead

router = APIRouter(prefix="/empresas", tags=["Empresas"])


@router.get("/", response_model=List[EmpresaRead])
def listar_empresas(skip: int = 0, limit: int = 100, session: Session = Depends(get_session)):
    query = select(Empresa).offset(skip).limit(limit)
    empresas = session.exec(query).all()
    return empresas


@router.get("/{empresa_id}", response_model=EmpresaRead)
def obtener_empresa(empresa_id: UUID, session: Session = Depends(get_session)):
    empresa = session.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")
    return empresa


@router.post("/", response_model=EmpresaRead, status_code=status.HTTP_201_CREATED)
def crear_empresa(payload: EmpresaCreate, session: Session = Depends(get_session)):
    empresa = Empresa(**payload.model_dump())
    session.add(empresa)
    session.commit()
    session.refresh(empresa)
    return empresa
