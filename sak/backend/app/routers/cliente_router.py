"""
Router para gestión de clientes/empresas receptoras
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models.cliente import Cliente, ClienteCreate, ClienteUpdate, ClienteRead

router = APIRouter(prefix="/api/v1/clientes", tags=["clientes"])


@router.post("/", response_model=ClienteRead)
def create_cliente(cliente: ClienteCreate, session: Session = Depends(get_session)):
    """Crear nuevo cliente"""
    # Verificar que no existe el CUIT
    existing = session.exec(select(Cliente).where(Cliente.cuit == cliente.cuit)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un cliente con ese CUIT")
    
    db_cliente = Cliente.model_validate(cliente)
    session.add(db_cliente)
    session.commit()
    session.refresh(db_cliente)
    return db_cliente


@router.get("/", response_model=List[ClienteRead])
def list_clientes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    activo: Optional[bool] = None,
    search: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """Listar clientes con filtros"""
    query = select(Cliente)
    
    if activo is not None:
        query = query.where(Cliente.activo == activo)
    
    if search:
        query = query.where(
            (Cliente.razon_social.contains(search)) |
            (Cliente.cuit.contains(search))
        )
    
    query = query.offset(skip).limit(limit)
    clientes = session.exec(query).all()
    return clientes


@router.get("/{cliente_id}", response_model=ClienteRead)
def get_cliente(cliente_id: int, session: Session = Depends(get_session)):
    """Obtener cliente por ID"""
    cliente = session.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente


@router.get("/by-cuit/{cuit}", response_model=ClienteRead)
def get_cliente_by_cuit(cuit: str, session: Session = Depends(get_session)):
    """Obtener cliente por CUIT"""
    cliente = session.exec(select(Cliente).where(Cliente.cuit == cuit)).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente


@router.put("/{cliente_id}", response_model=ClienteRead)
def update_cliente(
    cliente_id: int, 
    cliente_update: ClienteUpdate, 
    session: Session = Depends(get_session)
):
    """Actualizar cliente"""
    cliente = session.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    # Verificar CUIT único si se está actualizando
    if cliente_update.cuit and cliente_update.cuit != cliente.cuit:
        existing = session.exec(select(Cliente).where(Cliente.cuit == cliente_update.cuit)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe un cliente con ese CUIT")
    
    cliente_data = cliente_update.model_dump(exclude_unset=True)
    for key, value in cliente_data.items():
        setattr(cliente, key, value)
    
    session.add(cliente)
    session.commit()
    session.refresh(cliente)
    return cliente


@router.delete("/{cliente_id}")
def delete_cliente(cliente_id: int, session: Session = Depends(get_session)):
    """Eliminar cliente (soft delete)"""
    cliente = session.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    cliente.activo = False
    session.add(cliente)
    session.commit()
    return {"message": "Cliente desactivado correctamente"}


@router.post("/search", response_model=List[ClienteRead])
def search_clientes_advanced(
    search_params: dict,
    session: Session = Depends(get_session)
):
    """Búsqueda avanzada de clientes"""
    query = select(Cliente).where(Cliente.activo == True)
    
    if "razon_social" in search_params:
        query = query.where(Cliente.razon_social.contains(search_params["razon_social"]))
    
    if "cuit" in search_params:
        query = query.where(Cliente.cuit.contains(search_params["cuit"]))
    
    if "direccion" in search_params:
        query = query.where(Cliente.direccion.contains(search_params["direccion"]))
    
    clientes = session.exec(query).all()
    return clientes
