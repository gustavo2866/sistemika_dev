"""
Adaptador para convertir router genérico a formato ra-data-json-server
"""
from fastapi import APIRouter, Response, Query, Depends, HTTPException
from sqlmodel import Session
from typing import Dict, List, Any
from app.db import get_session
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.models.base import filtrar_respuesta


def create_ra_data_router(
    model,
    crud: GenericCRUD,
    prefix: str,
    tags: list[str] | None = None,
) -> APIRouter:
    """
    Crea un router que usa el genérico internamente pero adapta las respuestas
    al formato ra-data-json-server manteniendo el filtrado automático
    """
    
    # Crear router base
    router = APIRouter(prefix=prefix, tags=tags or [prefix.strip("/")])
    
    @router.get("")
    def list_ra_format(
        response: Response,
        session: Session = Depends(get_session),
        # Parámetros ra-data-json-server
        _start: int = Query(0, description="Start index"),
        _end: int = Query(25, description="End index"),
        _sort: str = Query("id", description="Sort field"),
        _order: str = Query("ASC", regex="^(ASC|DESC)$", description="Sort direction"),
        # Parámetros genéricos adicionales
        filter: str = Query(None, description="JSON filters"),
        deleted: str = Query("exclude", regex="^(include|only|exclude)$"),
    ):
        """Listar con formato ra-data-json-server"""
        try:
            # Convertir parámetros ra-data a formato genérico
            page = (_start // (_end - _start)) + 1 if (_end - _start) > 0 else 1
            per_page = _end - _start
            
            # Parsear filtros si existen
            filters = {}
            if filter:
                import json
                try:
                    filters = json.loads(filter)
                except json.JSONDecodeError:
                    pass
            
            # Usar CRUD genérico
            items, total = crud.list(
                session,
                page=page,
                per_page=per_page,
                sort_by=_sort,
                sort_dir=_order.lower(),
                filters=filters,
                deleted=deleted,
            )
            
            # Aplicar filtrado automático
            items_filtered = [filtrar_respuesta(item) for item in items]
            
            # Configurar headers ra-data-json-server
            response.headers["X-Total-Count"] = str(total)
            response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"
            
            # Devolver array directo (formato ra-data)
            return items_filtered
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @router.get("/{obj_id}")
    def get_ra_format(
        obj_id: int,
        session: Session = Depends(get_session),
        deleted: str = Query("exclude", regex="^(include|only|exclude)$"),
    ):
        """Obtener objeto con formato ra-data-json-server"""
        obj = crud.get(session, obj_id, deleted=deleted)
        if not obj:
            raise HTTPException(status_code=404, detail=f"{model.__name__} no encontrado")
        
        # Aplicar filtrado y devolver objeto directo
        return filtrar_respuesta(obj)
    
    @router.post("", status_code=201)
    def create_ra_format(
        payload: Dict,
        session: Session = Depends(get_session),
    ):
        """Crear con formato ra-data-json-server"""
        try:
            obj = crud.create(session, payload)
            # Devolver objeto directo filtrado
            return filtrar_respuesta(obj)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    @router.put("/{obj_id}")
    def update_ra_format(
        obj_id: int,
        payload: Dict,
        session: Session = Depends(get_session),
    ):
        """Actualizar con formato ra-data-json-server"""
        try:
            obj = crud.update(session, obj_id, payload, check_version=False)
            if not obj:
                raise HTTPException(status_code=404, detail=f"{model.__name__} no encontrado")
            
            # Devolver objeto directo filtrado
            return filtrar_respuesta(obj)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    @router.delete("/{obj_id}")
    def delete_ra_format(
        obj_id: int,
        session: Session = Depends(get_session),
        hard: bool = Query(False, description="Hard delete"),
    ):
        """Eliminar con formato ra-data-json-server"""
        # Obtener objeto antes de eliminar
        obj = crud.get(session, obj_id)
        if not obj:
            raise HTTPException(status_code=404, detail=f"{model.__name__} no encontrado")
        
        # Filtrar antes de eliminar
        obj_filtered = filtrar_respuesta(obj)
        
        # Eliminar
        success = crud.delete(session, obj_id, hard=hard)
        if not success:
            raise HTTPException(status_code=500, detail="Error al eliminar")
        
        # Devolver objeto eliminado
        return obj_filtered
    
    @router.delete("")
    def delete_many_ra_format(
        filter: str = Query(..., description="JSON filter"),
        session: Session = Depends(get_session),
    ):
        """Eliminar múltiples con formato ra-data-json-server"""
        try:
            import json
            filter_data = json.loads(filter)
            ids = filter_data.get("id", [])
            
            deleted_items = []
            for obj_id in ids:
                obj = crud.get(session, obj_id)
                if obj:
                    obj_filtered = filtrar_respuesta(obj)
                    deleted_items.append(obj_filtered)
                    crud.delete(session, obj_id, hard=False)
            
            return deleted_items
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    return router
