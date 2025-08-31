import json
from typing import Dict, List, Type, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlmodel import SQLModel, Session
from app.db import get_session
from app.core.generic_crud import GenericCRUD
from app.core.responses import DataResponse, ListResponse, DeleteResponse, ErrorResponse, ErrorCodes

def create_generic_router(
    model: Type[SQLModel],
    crud: GenericCRUD,
    prefix: str,
    tags: list[str] | None = None,
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
            return DataResponse(data=obj)
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
        session: Session = Depends(get_session),
        page: int = Query(1, ge=1, description="Número de página"),
        perPage: int = Query(25, ge=1, le=100, description="Items por página"),
        sortBy: str = Query("created_at", description="Campo para ordenar"),
        sortDir: str = Query("asc", regex="^(asc|desc)$", description="Dirección del ordenamiento"),
        filter: Optional[str] = Query(None, description="Filtros en formato JSON"),
        fields: Optional[str] = Query(None, description="Campos a incluir (CSV)"),
        include: Optional[str] = Query(None, description="Relaciones a incluir (CSV)"),
        deleted: str = Query("exclude", regex="^(include|only|exclude)$", description="Manejo de elementos eliminados"),
    ):
        """Listar recursos con paginación y filtros"""
        try:
            # Parsear filtros JSON
            filters = {}
            if filter:
                try:
                    filters = json.loads(filter)
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
                per_page=perPage,
                sort_by=sortBy,
                sort_dir=sortDir,
                filters=filters,
                deleted=deleted,
                fields=fields,
                include=include,
            )
            
            return ListResponse(data=items, total=total)
            
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
        return DataResponse(data=obj)

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
            return DataResponse(data=obj)
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
            return DataResponse(data=obj)
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
        ok = crud.delete(session, obj_id, hard=hard)
        if not ok:
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
        return DataResponse(data=True)

    return router
