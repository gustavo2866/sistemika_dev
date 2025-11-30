import json
from typing import Any
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy import func
from sqlmodel import Session, select

from app.core.router import create_generic_router, flatten_nested_filters
from app.crud.crm_mensaje_crud import crm_mensaje_crud
from app.db import get_session
from app.models import CRMMensaje
from app.services.crm_mensaje_service import crm_mensaje_service


router = create_generic_router(
    model=CRMMensaje,
    crud=crm_mensaje_crud,
    prefix="/crm/mensajes",
    tags=["crm-mensajes"],
)


def _build_filters(request: Request) -> dict[str, Any]:
    filters: dict[str, Any] = {}
    reserved = {"sort", "range", "page", "perPage"}

    for key in request.query_params:
        if key in reserved or key == "filter":
            continue
        if key not in {"q"} and not hasattr(CRMMensaje, key):
            continue
        values = request.query_params.getlist(key)
        if len(values) == 1:
            filters[key] = values[0]
        elif len(values) > 1:
            filters[key] = values

    if "filter" in request.query_params:
        try:
            raw = request.query_params["filter"]
            filter_dict = json.loads(raw)
            flat = flatten_nested_filters(filter_dict)
            filters.update(flat)
        except json.JSONDecodeError:
            pass
    return filters


@router.get("/aggregates/tipo")
def mensajes_tipo_aggregate(
    request: Request,
    session: Session = Depends(get_session),
):
    filters = _build_filters(request)
    base_filters = {k: v for k, v in filters.items() if k != "tipo"}

    stmt = select(CRMMensaje.tipo, func.count()).group_by(CRMMensaje.tipo)
    stmt = crm_mensaje_crud._apply_filters(stmt, base_filters)
    rows = session.exec(stmt).all()
    data = [{"tipo": tipo, "total": total} for tipo, total in rows]
    return {"data": data}


@router.get("/aggregates/estado")
def mensajes_estado_aggregate(
    request: Request,
    session: Session = Depends(get_session),
):
    filters = _build_filters(request)
    base_filters = {k: v for k, v in filters.items() if k != "estado"}

    stmt = select(CRMMensaje.estado, func.count()).group_by(CRMMensaje.estado)
    stmt = crm_mensaje_crud._apply_filters(stmt, base_filters)
    rows = session.exec(stmt).all()
    data = [{"estado": estado, "total": total} for estado, total in rows]
    return {"data": data}


@router.post("/entrada")
def crear_mensaje_entrada(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    """Alias de create que fuerza tipo=entrada y estado=nuevo."""
    data = {"tipo": "entrada", "estado": "nuevo", **payload}
    try:
        mensaje = crm_mensaje_crud.create(session, data)
        return mensaje
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{mensaje_id}/confirmar")
def confirmar_mensaje(
    mensaje_id: int,
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    try:
        mensaje = crm_mensaje_service.confirmar(session, mensaje_id, payload)
        return mensaje
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{mensaje_id}/reintentar")
def reintentar_mensaje(
    mensaje_id: int,
    session: Session = Depends(get_session),
):
    try:
        mensaje = crm_mensaje_service.reintentar_salida(session, mensaje_id)
        return mensaje
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{mensaje_id}/llm-sugerir")
def sugerir_mensaje_llm(
    mensaje_id: int,
    payload: dict = Body({}, description="Opcional: {'force': true} para refrescar"),
    session: Session = Depends(get_session),
):
    force = bool(payload.get("force")) if isinstance(payload, dict) else False
    try:
        suggestions = crm_mensaje_service.sugerir_llm(session, mensaje_id, force=force)
        return {"llm_suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{mensaje_id}/crear-oportunidad")
def crear_oportunidad_desde_mensaje(
    mensaje_id: int,
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    try:
        mensaje = crm_mensaje_service.crear_oportunidad_desde_mensaje(session, mensaje_id, payload)
        return mensaje
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{mensaje_id}/responder")
def responder_mensaje(
    mensaje_id: int,
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    """
    Responde a un mensaje, creando contacto y oportunidad si es necesario.
    
    Payload:
        - asunto: str (opcional, se agregará RE: automáticamente)
        - contenido: str (obligatorio)
        - contacto_nombre: str (obligatorio si el mensaje no tiene contacto_id)
        - responsable_id: int (opcional, ID del usuario autenticado)
    
    Retorna:
        - mensaje_salida: objeto del mensaje de respuesta creado
        - contacto_creado: bool
        - contacto_id: int
        - oportunidad_creada: bool
        - oportunidad_id: int
    """
    try:
        resultado = crm_mensaje_service.responder_mensaje(session, mensaje_id, payload)
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al responder mensaje: {str(e)}")


@router.get("/{mensaje_id}/actividades")
def obtener_actividades_mensaje(
    mensaje_id: int,
    session: Session = Depends(get_session),
):
    """
    Obtiene actividades relacionadas a un mensaje.
    Redirige a obtener_actividades con los parámetros apropiados.
    """
    mensaje = session.get(CRMMensaje, mensaje_id)
    if not mensaje:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    return obtener_actividades(
        session=session,
        mensaje_id=mensaje_id,
        contacto_id=mensaje.contacto_id,
        oportunidad_id=mensaje.oportunidad_id
    )


@router.get("/buscar-actividades")
def obtener_actividades(
    session: Session = Depends(get_session),
    mensaje_id: int | None = None,
    contacto_id: int | None = None,
    oportunidad_id: int | None = None,
):
    """
    Obtiene mensajes y eventos relacionados según los parámetros proporcionados.
    
    Lógica de búsqueda (en orden de prioridad):
    1. Si hay oportunidad_id → busca mensajes y eventos de esa oportunidad
    2. Si no hay oportunidad pero hay contacto_id → busca mensajes y eventos de ese contacto
    3. Si solo hay mensaje_id → busca por referencia del contacto
    
    Parámetros:
    - mensaje_id: ID del mensaje (opcional, para contexto)
    - contacto_id: ID del contacto (opcional)
    - oportunidad_id: ID de la oportunidad (opcional)
    
    Retorna una lista combinada y ordenada cronológicamente.
    """
    from app.models import CRMEvento, CRMContacto
    from datetime import datetime
    
    actividades = []
    criterio_busqueda = None
    contacto_referencia = None
    
    # Determinar criterio de búsqueda
    if oportunidad_id:
        criterio_busqueda = "oportunidad"
    elif contacto_id:
        criterio_busqueda = "contacto"
    elif mensaje_id:
        mensaje = session.get(CRMMensaje, mensaje_id)
        if mensaje:
            if mensaje.oportunidad_id:
                oportunidad_id = mensaje.oportunidad_id
                criterio_busqueda = "oportunidad"
            elif mensaje.contacto_id:
                contacto_id = mensaje.contacto_id
                criterio_busqueda = "contacto"
            else:
                contacto_referencia = mensaje.contacto_referencia
                criterio_busqueda = "referencia"
    
    if not criterio_busqueda:
        return {
            "criterio": None,
            "mensaje_id": mensaje_id,
            "contacto_id": contacto_id,
            "oportunidad_id": oportunidad_id,
            "total": 0,
            "actividades": []
        }
    
    # Buscar mensajes según criterio
    if criterio_busqueda == "oportunidad":
        stmt_mensajes = (
            select(CRMMensaje)
            .where(CRMMensaje.oportunidad_id == oportunidad_id)
            .where(CRMMensaje.deleted_at.is_(None))
            .order_by(CRMMensaje.fecha_mensaje.desc())
        )
    elif criterio_busqueda == "contacto":
        stmt_mensajes = (
            select(CRMMensaje)
            .where(CRMMensaje.contacto_id == contacto_id)
            .where(CRMMensaje.deleted_at.is_(None))
            .order_by(CRMMensaje.fecha_mensaje.desc())
        )
    else:  # referencia
        stmt_mensajes = (
            select(CRMMensaje)
            .where(CRMMensaje.contacto_referencia == contacto_referencia)
            .where(CRMMensaje.deleted_at.is_(None))
            .order_by(CRMMensaje.fecha_mensaje.desc())
        )
    
    mensajes = session.exec(stmt_mensajes).all()
    
    for msg in mensajes:
        actividades.append({
            "tipo": "mensaje",
            "id": msg.id,
            "fecha": msg.fecha_mensaje.isoformat() if msg.fecha_mensaje else msg.created_at.isoformat(),
            "descripcion": msg.asunto or (msg.contenido[:60] + "..." if msg.contenido and len(msg.contenido) > 60 else msg.contenido),
            "canal": msg.canal,
            "estado": msg.estado,
            "tipo_mensaje": msg.tipo,
        })
    
    # Buscar eventos según criterio (solo si hay oportunidad o contacto)
    if criterio_busqueda in ["oportunidad", "contacto"]:
        if criterio_busqueda == "oportunidad":
            stmt_eventos = (
                select(CRMEvento)
                .where(CRMEvento.oportunidad_id == oportunidad_id)
                .where(CRMEvento.deleted_at.is_(None))
                .order_by(CRMEvento.fecha_evento.desc())
            )
        else:  # contacto
            stmt_eventos = (
                select(CRMEvento)
                .where(CRMEvento.contacto_id == contacto_id)
                .where(CRMEvento.deleted_at.is_(None))
                .order_by(CRMEvento.fecha_evento.desc())
            )
        
        eventos = session.exec(stmt_eventos).all()
        
        for evento in eventos:
            actividades.append({
                "tipo": "evento",
                "id": evento.id,
                "fecha": evento.fecha_evento.isoformat(),
                "descripcion": evento.descripcion[:80] + "..." if len(evento.descripcion) > 80 else evento.descripcion,
                "estado": evento.estado_evento,
                "tipo_id": evento.tipo_id,
                "motivo_id": evento.motivo_id,
            })
    
    # Ordenar todas las actividades por fecha (más reciente primero)
    actividades.sort(key=lambda x: x["fecha"], reverse=True)
    
    return {
        "criterio": criterio_busqueda,
        "mensaje_id": mensaje_id,
        "contacto_id": contacto_id,
        "oportunidad_id": oportunidad_id,
        "contacto_referencia": contacto_referencia if criterio_busqueda == "referencia" else None,
        "total": len(actividades),
        "actividades": actividades
    }
