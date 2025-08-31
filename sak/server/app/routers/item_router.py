from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session, select, func
from app.models.item import Item
from app.models.item_dto import ItemDTO, ItemCreateDTO, ItemUpdateDTO
from app.core.generic_crud import GenericCRUD
from app.db import get_session

# CRUD básico
item_crud = GenericCRUD(Item)
router = APIRouter(prefix="/items", tags=["items"])

def item_to_dto(item: Item) -> ItemDTO:
    """Convierte Item a ItemDTO - filtra campos stamp"""
    return ItemDTO(
        id=item.id,
        name=item.name,
        description=item.description
    )

@router.get("")
def list_items(
    response: Response,
    session: Session = Depends(get_session),
    _start: int = Query(0, description="Start index estándar ra-data-json-server"),
    _end: int = Query(25, description="End index estándar ra-data-json-server"),
    _sort: str = Query("id", description="Campo para ordenar estándar ra-data-json-server"),
    _order: str = Query("ASC", regex="^(ASC|DESC)$", description="Dirección estándar ra-data-json-server"),
):
    """Listar items - Formato ra-data-json-server estándar con soft delete automático"""
    try:
        # Calcular page y per_page para el CRUD
        page = (_start // (_end - _start)) + 1 if (_end - _start) > 0 else 1
        per_page = _end - _start
        
        # Usar el CRUD que maneja soft delete automáticamente
        items, total = item_crud.list(
            session,
            page=page,
            per_page=per_page,
            sort_by=_sort,
            sort_dir=_order.lower(),
            deleted="exclude"  # Excluir soft-deleted explícitamente
        )
        
        # Convertir a DTOs
        items_dto = [item_to_dto(item) for item in items]
        
        # Formato ra-data-json-server: Array directo + header X-Total-Count
        response.headers["X-Total-Count"] = str(total)
        response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"
        
        return items_dto
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{item_id}")
def get_item(
    item_id: int,
    session: Session = Depends(get_session),
):
    """Obtener item por ID - Formato JSONServer estándar"""
    item = item_crud.get(session, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    
    # Formato JSONServer: Objeto directo
    return item_to_dto(item)

@router.post("", status_code=201)
def create_item(
    payload: ItemCreateDTO,
    session: Session = Depends(get_session),
):
    """Crear nuevo item - Formato JSONServer estándar"""
    try:
        # Convertir DTO a dict para el CRUD
        data = payload.model_dump()
        item = item_crud.create(session, data)
        
        # Formato JSONServer: Objeto directo
        return item_to_dto(item)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{item_id}")
def update_item(
    item_id: int,
    payload: ItemUpdateDTO,
    session: Session = Depends(get_session),
):
    """Actualizar item - Formato JSONServer estándar"""
    try:
        # Convertir DTO a dict para el CRUD
        data = payload.model_dump()
        # El GenericCRUD automáticamente filtra los campos stamp con _extract_update
        item = item_crud.update(session, item_id, data, check_version=False)
        
        if not item:
            raise HTTPException(status_code=404, detail="Item no encontrado")
        
        # Formato JSONServer: Objeto directo
        return item_to_dto(item)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{item_id}")
def delete_item(
    item_id: int,
    session: Session = Depends(get_session),
):
    """Eliminar item - Formato ra-data-json-server estándar"""
    # Obtener el item
    item = item_crud.get(session, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    
    # Convertir a DTO antes de eliminar (estándar JSON Server)
    item_dto = item_to_dto(item)
    
    # Eliminar
    success = item_crud.delete(session, item_id, hard=False)
    if not success:
        raise HTTPException(status_code=500, detail="Error al eliminar")
    
    # Formato JSON Server: devolver el objeto eliminado
    return item_dto

@router.delete("")
def delete_many_items(
    filter: str = Query(..., description="Filter JSON para items a eliminar - formato tutorial estándar"),
    session: Session = Depends(get_session),
):
    """Eliminar múltiples items - Siguiendo EXACTAMENTE el tutorial oficial"""
    try:
        import json
        
        # Parsear el filtro JSON estándar del tutorial
        filter_data = json.loads(filter)
        ids = filter_data.get("id", [])
        
        print(f"🔥 BULK DELETE estándar - IDs del filtro: {ids}")
        deleted_items = []
        
        for item_id in ids:
            # Obtener el item
            item = item_crud.get(session, item_id)
            if item:
                print(f"✅ Eliminando item {item_id}: {item.name}")
                # Convertir a DTO antes de eliminar
                item_dto = item_to_dto(item)
                deleted_items.append(item_dto)
                
                # Eliminar
                item_crud.delete(session, item_id, hard=False)
            else:
                print(f"❌ Item {item_id} no encontrado")
        
        print(f"🎯 Items eliminados: {len(deleted_items)}")
        # Retornar los items eliminados (formato tutorial estándar)
        return deleted_items
    except Exception as e:
        print(f"💥 Error en bulk delete: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

