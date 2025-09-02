from fastapi import Depends, HTTPException, Query
from sqlmodel import Session
from app.models.item import Item
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session

# Crear CRUD e instanciar router genérico optimizado para ra-data-json-server
item_crud = GenericCRUD(Item)
router = create_generic_router(Item, item_crud, "/items", ["items"])

# Endpoint adicional para bulk delete (específico de ra-data-json-server)
@router.delete("")
def delete_many_items(
    filter: str = Query(..., description="Filter JSON para items a eliminar"),
    session: Session = Depends(get_session),
):
    """Eliminar múltiples items - Formato ra-data-json-server"""
    try:
        import json
        
        # Parsear el filtro JSON
        filter_data = json.loads(filter)
        ids = filter_data.get("id", [])
        
        deleted_items = []
        
        for item_id in ids:
            # Obtener el item antes de eliminar
            item = item_crud.get(session, item_id)
            if item:
                # Filtrar y agregar a la lista
                from app.models.base import filtrar_respuesta
                item_filtered = filtrar_respuesta(item)
                deleted_items.append(item_filtered)
                
                # Eliminar (soft delete)
                item_crud.delete(session, item_id, hard=False)
        
        # Retornar los items eliminados (formato ra-data-json-server)
        return deleted_items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

