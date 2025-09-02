import json
import json
from typing import Dict, List, Type, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, Request
from sqlmodel import SQLModel, Session
from app.db import get_session
from app.core.generic_crud import GenericCRUD
from app.core.responses import DataResponse, ListResponse, DeleteResponse, ErrorResponse, ErrorCodes
from app.models.base import filtrar_respuesta

def create_generic_router(
    model: Type[SQLModel],
    crud: GenericCRUD,
    prefix: str,
    tags: list[str] | None = None,
    filter_responses: bool = True,
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=tags or [prefix.strip("/")])

    @router.post("", status_code=201)
    def create(
        payload: Dict = Body(...),
        session: Session = Depends(get_session),
    ):
        """Crear nuevo recurso"""
        try:
            obj = crud.create(session, payload)
            # Devolver objeto directo filtrado (formato ra-data-json-server)
            response_data = filtrar_respuesta(obj) if filter_responses else obj
            return response_data
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "code": ErrorCodes.VALIDATION_ERROR,
                        "message": str(e),
                        "details": {}
                    }
                }
            )

    @router.get("")
    def list_objects(
        request: Request,
        response: Response,  # Agregamos Response para headers
        session: Session = Depends(get_session),
        # Parámetros ra-data-simple-rest (nuevos)
        sort: Optional[str] = Query(None, description="Sort array ra-data-simple-rest: [field,order]"),
        range: Optional[str] = Query(None, description="Range array ra-data-simple-rest: [start,end]"),
        filter: Optional[str] = Query(None, description="Filter object ra-data-simple-rest"),
        # Parámetros ra-data-json-server (legacy - mantener compatibilidad)
        _start: int = Query(None, description="Start index ra-data-json-server"),
        _end: int = Query(None, description="End index ra-data-json-server"),
        _sort: str = Query(None, description="Sort field ra-data-json-server"),
        _order: str = Query(None, regex="^(ASC|DESC)$", description="Sort direction ra-data-json-server"),
        # Filtro de búsqueda general
        q: Optional[str] = Query(None, description="Búsqueda de texto"),
        # Parámetros genéricos (fallback)
        page: int = Query(1, ge=1, description="Número de página"),
        perPage: int = Query(25, ge=1, le=100, description="Items por página"),
        sortBy: str = Query("created_at", description="Campo para ordenar"),
        sortDir: str = Query("asc", regex="^(asc|desc)$", description="Dirección del ordenamiento"),
        fields: Optional[str] = Query(None, description="Campos a incluir (CSV)"),
        include: Optional[str] = Query(None, description="Relaciones a incluir (CSV)"),
        deleted: str = Query("exclude", regex="^(include|only|exclude)$", description="Manejo de elementos eliminados"),
    ):
        """Listar recursos con paginación y filtros - Soporte ra-data-simple-rest y json-server"""
        try:
            # Detectar formato y procesar parámetros
            if sort is not None or range is not None:
                # Usar parámetros ra-data-simple-rest
                if range:
                    try:
                        range_parsed = json.loads(range)
                        start, end = range_parsed[0], range_parsed[1]
                        page = (start // (end - start + 1)) + 1 if (end - start + 1) > 0 else 1
                        per_page = end - start + 1
                    except (json.JSONDecodeError, IndexError):
                        page, per_page = 1, 25
                else:
                    page, per_page = 1, 25
                
                if sort:
                    try:
                        sort_parsed = json.loads(sort)
                        sort_by = sort_parsed[0] if len(sort_parsed) > 0 else "id"
                        sort_dir = sort_parsed[1].lower() if len(sort_parsed) > 1 else "asc"
                    except (json.JSONDecodeError, IndexError):
                        sort_by, sort_dir = "id", "asc"
                else:
                    sort_by, sort_dir = "id", "asc"
                    
            elif _start is not None and _end is not None:
                # Usar parámetros ra-data-json-server (legacy)
                page = (_start // (_end - _start)) + 1 if (_end - _start) > 0 else 1
                per_page = _end - _start
                sort_by = _sort if _sort else "id"
                sort_dir = _order.lower() if _order else "asc"
            else:
                # Usar parámetros genéricos
                per_page = perPage
                sort_by = sortBy
                sort_dir = sortDir
            
            # Procesar filtros
            filters = {}
            
            # Agregar búsqueda general si existe (solo usa __searchable_fields__ del modelo)
            if q:
                filters["q"] = q
            
            # Obtener filtros dinámicos de query parameters
            query_params = dict(request.query_params)
            
            # Parámetros reservados que no son filtros de campo
            reserved_params = {
                'sort', 'range', 'filter',  # ra-data-simple-rest
                '_start', '_end', '_sort', '_order',  # ra-data-json-server legacy
                'q', 'page', 'perPage', 'sortBy', 'sortDir', 'fields', 'include', 'deleted'
            }
            
            # Agregar cualquier parámetro como filtro (excepto los reservados)
            for param_name, param_value in query_params.items():
                if param_name not in reserved_params and param_value:
                    # Convertir tipos apropiados para foreign keys
                    if param_name.endswith('_id') and param_value.isdigit():
                        filters[param_name] = int(param_value)
                    else:
                        filters[param_name] = param_value
            
            # Luego parsear filtros JSON si existen
            if filter:
                try:
                    json_filters = json.loads(filter)
                    filters.update(json_filters)
                except json.JSONDecodeError:
                    raise HTTPException(
                        status_code=400,
                        detail={
                            "error": {
                                "code": ErrorCodes.VALIDATION_ERROR,
                                "message": "Formato de filtro JSON inválido",
                                "details": {"filter": filter}
                            }
                        }
                    )
            
            items, total = crud.list(
                session,
                page=page,
                per_page=per_page,
                sort_by=sort_by,
                sort_dir=sort_dir,
                filters=filters,
                deleted=deleted,
                fields=fields,
                include=include,
            )
            
            # Filtrar respuestas si está habilitado
            if filter_responses:
                filtered_items = [filtrar_respuesta(item) for item in items]
            else:
                filtered_items = items
            
            # Configurar headers para ra-data-simple-rest
            start = (page - 1) * per_page
            end = min(start + per_page - 1, total - 1) if total > 0 else 0
            
            # Asegurar que end no sea menor que start
            if end < start and total > 0:
                end = start
            
            content_range = f"items {start}-{end}/{total}"
            response.headers["Content-Range"] = content_range
            
            # Devolver array directo (formato ra-data-json-server)
            return filtered_items
            
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail={
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": str(e),
                        "details": {}
                    }
                }
            )

    @router.get("/{obj_id}")
    def get_one(
        obj_id: int, 
        session: Session = Depends(get_session),
        deleted: str = Query("exclude", regex="^(include|only|exclude)$"),
    ):
        """Obtener recurso por ID"""
        obj = crud.get(session, obj_id, deleted=deleted)
        if not obj:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": {
                        "code": ErrorCodes.NOT_FOUND,
                        "message": f"{model.__name__} no encontrado",
                        "details": {"id": obj_id}
                    }
                }
            )
        
        # Devolver objeto directo filtrado (formato ra-data-json-server)
        response_data = filtrar_respuesta(obj) if filter_responses else obj
        return response_data

    @router.put("/{obj_id}")
    def update_full(
        obj_id: int,
        payload: Dict = Body(...),
        session: Session = Depends(get_session),
    ):
        """Actualizar recurso completo con lock optimista"""
        try:
            obj = crud.update(session, obj_id, payload, check_version=True)
            if not obj:
                raise HTTPException(
                    status_code=404,
                    detail={
                        "error": {
                            "code": ErrorCodes.NOT_FOUND,
                            "message": f"{model.__name__} no encontrado",
                            "details": {"id": obj_id}
                        }
                    }
                )
            # Devolver objeto directo filtrado (formato ra-data-json-server)
            response_data = filtrar_respuesta(obj) if filter_responses else obj
            return response_data
        except HTTPException:
            raise  # Re-lanzar HTTPExceptions (como CONFLICT)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "code": ErrorCodes.VALIDATION_ERROR,
                        "message": str(e),
                        "details": {}
                    }
                }
            )

    @router.patch("/{obj_id}")
    def update_partial(
        obj_id: int,
        payload: Dict = Body(...),
        session: Session = Depends(get_session),
    ):
        """Actualizar recurso parcial"""
        try:
            obj = crud.update_partial(session, obj_id, payload)
            if not obj:
                raise HTTPException(
                    status_code=404,
                    detail={
                        "error": {
                            "code": ErrorCodes.NOT_FOUND,
                            "message": f"{model.__name__} no encontrado",
                            "details": {"id": obj_id}
                        }
                    }
                )
            # Devolver objeto directo filtrado (formato ra-data-json-server)
            response_data = filtrar_respuesta(obj) if filter_responses else obj
            return response_data
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "code": ErrorCodes.VALIDATION_ERROR,
                        "message": str(e),
                        "details": {}
                    }
                }
            )

    @router.delete("/{obj_id}")
    def delete(
        obj_id: int, 
        session: Session = Depends(get_session),
        hard: bool = Query(False, description="Eliminación física (true) o lógica (false)"),
    ):
        """Eliminar recurso"""
        # Obtener objeto antes de eliminar para devolverlo (formato ra-data-json-server)
        obj = crud.get(session, obj_id)
        if not obj:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": {
                        "code": ErrorCodes.NOT_FOUND,
                        "message": f"{model.__name__} no encontrado",
                        "details": {"id": obj_id}
                    }
                }
            )
        
        # Filtrar antes de eliminar
        obj_filtered = filtrar_respuesta(obj) if filter_responses else obj
        
        # Eliminar
        ok = crud.delete(session, obj_id, hard=hard)
        if not ok:
            raise HTTPException(status_code=500, detail="Error al eliminar")
        
        # Devolver objeto eliminado (formato ra-data-json-server)
        return obj_filtered

    return router
