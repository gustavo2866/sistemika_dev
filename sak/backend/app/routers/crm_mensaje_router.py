import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy import and_, func, or_, update
from sqlmodel import Session, select
import httpx

from app.core.router import create_generic_router, flatten_nested_filters
from app.models.base import filtrar_respuesta, serialize_datetime
from app.crud.crm_mensaje_crud import crm_mensaje_crud
from app.db import get_session
from app.models import CRMMensaje, CRMCelular, CRMContacto, CRMOportunidad, CRMTipoOperacion
from app.models.enums import TipoMensaje, CanalMensaje, EstadoMensaje
from app.services.crm_mensaje_service import crm_mensaje_service
from app.services.metaw_client import metaw_client
from app.schemas.crm_mensaje_responder import ResponderMensajeRequest, ResponderMensajeResponse


router = create_generic_router(
    model=CRMMensaje,
    crud=crm_mensaje_crud,
    prefix="/crm/mensajes",
    tags=["crm-mensajes"],
)

logger = logging.getLogger(__name__)


def _fetch_event_rows_dynamic(session: Session, oportunidad_id: int) -> list[dict[str, Any]]:
    """
    Obtiene eventos del esquema refactorizado.
    Devuelve una lista de dicts normalizados para el panel de actividades.
    """
    from app.models.crm import CRMEvento
    
    stmt = (
        select(CRMEvento)
        .where(CRMEvento.oportunidad_id == oportunidad_id)
        .where(CRMEvento.deleted_at.is_(None))
        .order_by(CRMEvento.fecha_evento.desc())
    )
    
    eventos = session.exec(stmt).all()
    normalized: list[dict[str, Any]] = []
    
    for evento in eventos:
        fecha_val = evento.fecha_evento or evento.created_at
        titulo = evento.titulo or f"Evento #{evento.id}"
        descripcion_resumen = evento.resultado[:80] + "..." if evento.resultado and len(evento.resultado) > 80 else evento.resultado
        
        tipo_codigo = evento.tipo_catalogo.codigo if evento.tipo_catalogo else None
        tipo_nombre = evento.tipo_catalogo.nombre if evento.tipo_catalogo else None
        normalized.append({
            "tipo": "evento",
            "id": evento.id,
            "fecha": fecha_val.isoformat(),
            "titulo": titulo,
            "descripcion": descripcion_resumen,
            "estado": evento.estado_evento,
            "tipo_evento": tipo_codigo or tipo_nombre,
            "resultado": evento.resultado,
        })
    
    return normalized

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


def _parse_cursor(raw: str) -> tuple[datetime, int] | None:
    try:
        ts_raw, id_raw = raw.split("|", 1)
        ts_value = ts_raw.replace("Z", "+00:00").replace(" ", "+")
        timestamp = datetime.fromisoformat(ts_value)
        mensaje_id = int(id_raw)
    except Exception:
        return None
    return timestamp, mensaje_id


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


@router.post("/{mensaje_id}/responder", response_model=ResponderMensajeResponse)
async def responder_mensaje_whatsapp(
    mensaje_id: int,
    request: ResponderMensajeRequest,
    session: Session = Depends(get_session),
):
    """
    Responde a un mensaje de WhatsApp a través de meta-w.
    
    1. Busca el mensaje original
    2. Crea oportunidad en estado 0-prospect si no existe
    3. Actualiza mensaje original a estado 'recibido'
    4. Crea registro de mensaje de salida en crm_mensajes
    5. Llama a meta-w para enviar el mensaje
    6. Actualiza estado según respuesta de meta-w
    
    Args:
        mensaje_id: ID del mensaje a responder
        request: Datos de la respuesta (texto, template_fallback)
        
    Returns:
        ResponderMensajeResponse con ID del mensaje creado y estado
    """
    # 1. Buscar mensaje original
    mensaje_original = session.get(CRMMensaje, mensaje_id)
    if not mensaje_original:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    # 2. Validar que tenga contacto y referencia (teléfono)
    if not mensaje_original.contacto_referencia:
        raise HTTPException(
            status_code=400,
            detail="Mensaje no tiene contacto_referencia (teléfono)"
        )
    
    # 3. Crear oportunidad si no existe
    oportunidad_creada = False
    if not mensaje_original.oportunidad_id and mensaje_original.contacto_id:
        from app.models import CRMOportunidad
        from app.crud.crm_oportunidad_crud import crm_oportunidad_crud
        from datetime import datetime, UTC
        
        # Obtener responsable del contacto o del mensaje
        responsable_id = None
        if mensaje_original.contacto:
            responsable_id = mensaje_original.contacto.responsable_id
        if not responsable_id:
            responsable_id = mensaje_original.responsable_id
        
        if responsable_id:
            oportunidad_payload = {
                "contacto_id": mensaje_original.contacto_id,
                "estado": "0-prospect",
                "fecha_estado": datetime.now(UTC),
                "tipo_operacion_id": 1,  # TODO: obtener de configuración
                "propiedad_id": 4,  # TODO: permitir NULL o solicitar al usuario
                "titulo": "Nueva oportunidad desde WhatsApp",
                "descripcion": mensaje_original.contenido or "Consulta por WhatsApp",
                "descripcion_estado": "Nueva oportunidad desde WhatsApp",
                "responsable_id": responsable_id,
                "activo": True,
            }
            oportunidad = crm_oportunidad_crud.create(session, oportunidad_payload)
            mensaje_original.oportunidad_id = oportunidad.id
            oportunidad_creada = True
            logger.info(f"Oportunidad {oportunidad.id} creada para mensaje {mensaje_id}")
    
    # 4. Actualizar estado del mensaje original a 'recibido'
    if mensaje_original.estado in [EstadoMensaje.NUEVO.value, "descartado"]:
        mensaje_original.estado = EstadoMensaje.RECIBIDO.value
        logger.info(f"Mensaje {mensaje_id} actualizado a estado 'recibido'")
    
    session.commit()
    session.refresh(mensaje_original)
    
    # 5. Obtener celular para respuesta (priorizar el del mensaje original)
    celular = None
    
    # Intentar usar el mismo celular del mensaje original
    if mensaje_original.celular_id:
        celular = session.get(CRMCelular, mensaje_original.celular_id)
        if celular and not celular.activo:
            celular = None  # Fallback si el celular original está inactivo
    
    # Si no hay celular del mensaje original, buscar uno activo
    if not celular:
        stmt = select(CRMCelular).where(CRMCelular.activo == True).limit(1)
        celular = session.exec(stmt).first()
    
    if not celular:
        raise HTTPException(
            status_code=404,
            detail="No hay celular (canal WhatsApp) activo configurado"
        )
    
    # 6. Crear mensaje de salida en crm_mensajes
    mensaje_salida = CRMMensaje(
        tipo=TipoMensaje.SALIDA.value,
        canal=CanalMensaje.WHATSAPP.value,
        contacto_id=mensaje_original.contacto_id,
        contacto_referencia=mensaje_original.contacto_referencia,
        oportunidad_id=mensaje_original.oportunidad_id,
        estado=EstadoMensaje.PENDIENTE_ENVIO.value,
        contenido=request.texto,
        celular_id=celular.id,
        estado_meta="pending"
    )
    session.add(mensaje_salida)
    session.commit()
    session.refresh(mensaje_salida)
    
    # Actualizar ultimo_mensaje en oportunidad
    from app.services.crm_mensaje_service import CRMMensajeService
    CRMMensajeService.actualizar_ultimo_mensaje_oportunidad(session, mensaje_salida)
    
    # 7. Enviar a través de meta-w
    try:
        # meta-w requiere empresa_id y celular_id como UUIDs
        # Por ahora usamos meta_celular_id del celular (UUID)
        if not celular.meta_celular_id:
            raise HTTPException(
                status_code=400,
                detail=f"Celular {celular.id} no tiene meta_celular_id configurado"
            )
        
        # Necesitamos empresa_id - por ahora hardcodeado (TODO: obtener de configuración)
        EMPRESA_ID = "692d787d-06c4-432e-a94e-cf0686e593eb"
        
        # Limpiar teléfono (remover + si existe)
        telefono_limpio = mensaje_original.contacto_referencia.replace("+", "")
        
        # Obtener nombre del contacto si existe
        nombre_contacto = None
        if mensaje_original.contacto:
            nombre_contacto = mensaje_original.contacto.nombre_completo
        
        resultado_metaw = await metaw_client.enviar_mensaje(
            empresa_id=EMPRESA_ID,
            celular_id=celular.meta_celular_id,
            telefono_destino=telefono_limpio,
            texto=request.texto,
            nombre_contacto=nombre_contacto,
            template_fallback_name=request.template_fallback_name,
            template_fallback_language=request.template_fallback_language
        )
        
        # 8. Actualizar mensaje con respuesta de meta-w
        mensaje_salida.estado_meta = resultado_metaw.get("status", "sent")
        mensaje_salida.origen_externo_id = resultado_metaw.get("meta_message_id")
        mensaje_salida.estado = EstadoMensaje.ENVIADO.value
        session.commit()
        session.refresh(mensaje_salida)
        
        logger.info(
            f"Respuesta enviada: mensaje {mensaje_salida.id}, "
            f"oportunidad_creada={oportunidad_creada}, "
            f"meta_id={mensaje_salida.origen_externo_id}"
        )
        
        return ResponderMensajeResponse(
            mensaje_id=mensaje_salida.id,
            status=mensaje_salida.estado_meta,
            meta_message_id=mensaje_salida.origen_externo_id
        )
        
    except httpx.HTTPStatusError as e:
        # Error de meta-w
        error_msg = f"Error meta-w: {e.response.status_code} - {e.response.text}"
        logger.error(error_msg)
        
        mensaje_salida.estado = EstadoMensaje.ERROR_ENVIO.value
        mensaje_salida.estado_meta = "failed"
        mensaje_salida.metadata_json = {
            "error": error_msg,
            "error_code": e.response.status_code
        }
        session.commit()
        
        return ResponderMensajeResponse(
            mensaje_id=mensaje_salida.id,
            status="failed",
            error_message=error_msg
        )
        
    except Exception as e:
        # Error general
        error_msg = f"Error al enviar mensaje: {str(e)}"
        logger.error(error_msg, exc_info=True)
        
        mensaje_salida.estado = EstadoMensaje.ERROR_ENVIO.value
        mensaje_salida.estado_meta = "failed"
        mensaje_salida.metadata_json = {"error": error_msg}
        session.commit()
        
        return ResponderMensajeResponse(
            mensaje_id=mensaje_salida.id,
            status="failed",
            error_message=error_msg
        )


@router.post("/{mensaje_id}/responder-legacy")
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


@router.post("/{mensaje_id}/agendar")
def agendar_evento_mensaje(
    mensaje_id: int,
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    """
    Agenda un evento asociado a un mensaje. Si no existe contacto u oportunidad
    vinculados al mensaje, se crean autom\u00e1ticamente.
    """
    try:
        return crm_mensaje_service.agendar_evento_para_mensaje(session, mensaje_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al agendar evento: {str(e)}")


@router.post("/acciones/enviar")
async def enviar_mensaje_desde_panel(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    try:
        return await crm_mensaje_service.enviar_mensaje(session, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al enviar mensaje: {str(e)}")


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
    2. Si no hay oportunidad pero hay contacto_id → busca mensajes de contacto y eventos relacionados
    3. Si solo hay mensaje_id → busca por referencia del contacto
    
    Parámetros:
    - mensaje_id: ID del mensaje (opcional, para contexto)
    - contacto_id: ID del contacto (opcional)
    - oportunidad_id: ID de la oportunidad (opcional)
    
    Retorna una lista combinada y ordenada cronológicamente.
    """
    from app.models import CRMContacto  # mantenido por compatibilidad futura
    
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
    
    # Buscar eventos solo si hay oportunidad (eventos ya no tienen contacto_id)
    if criterio_busqueda == "oportunidad":
        actividades.extend(_fetch_event_rows_dynamic(session, oportunidad_id))
    
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


@router.get("/acciones/buscar-actividades")
def obtener_actividades_alias(
    session: Session = Depends(get_session),
    mensaje_id: int | None = None,
    contacto_id: int | None = None,
    oportunidad_id: int | None = None,
):
    """Alias con prefijo adicional para evitar colisiones con rutas genéricas."""
    return obtener_actividades(
        session=session,
        mensaje_id=mensaje_id,
        contacto_id=contacto_id,
        oportunidad_id=oportunidad_id,
    )


@router.get("/acciones/cursor")
def mensajes_cursor(
    session: Session = Depends(get_session),
    contacto_id: int | None = None,
    oportunidad_id: int | None = None,
    contacto_referencia: str | None = None,
    canal: str | None = None,
    tipo: str | None = None,
    cursor: str | None = None,
    limit: int = 50,
):
    """
    Paginacion por cursor para mensajes. Devuelve los mas recientes y permite
    pedir mensajes anteriores con cursor.
    """
    limit = max(1, min(limit, 200))
    fecha_ref = func.coalesce(CRMMensaje.fecha_mensaje, CRMMensaje.created_at)

    stmt = select(CRMMensaje).where(CRMMensaje.deleted_at.is_(None))
    if oportunidad_id is not None:
        stmt = stmt.where(CRMMensaje.oportunidad_id == oportunidad_id)
    elif contacto_id is not None:
        stmt = stmt.where(CRMMensaje.contacto_id == contacto_id)
    elif contacto_referencia is not None:
        stmt = stmt.where(CRMMensaje.contacto_referencia == contacto_referencia)

    if canal is not None:
        stmt = stmt.where(CRMMensaje.canal == canal)
    if tipo is not None:
        stmt = stmt.where(CRMMensaje.tipo == tipo)

    if cursor:
        parsed = _parse_cursor(cursor)
        if parsed:
            cursor_time, cursor_id = parsed
            stmt = stmt.where(
                or_(
                    fecha_ref < cursor_time,
                    and_(fecha_ref == cursor_time, CRMMensaje.id < cursor_id),
                )
            )

    stmt = stmt.order_by(fecha_ref.desc(), CRMMensaje.id.desc()).limit(limit + 1)
    rows = session.exec(stmt).all()

    has_more = len(rows) > limit
    data = rows[:limit]
    next_cursor = None
    if has_more and data:
        last = data[-1]
        last_time = last.fecha_mensaje or last.created_at
        if last_time:
            next_cursor = f"{serialize_datetime(last_time)}|{last.id}"

    filtered_data = [filtrar_respuesta(item) for item in data]
    return {"data": filtered_data, "next_cursor": next_cursor, "has_more": has_more}


@router.post("/acciones/marcar-leidos")
def marcar_mensajes_leidos(
    payload: dict = Body(...),
    session: Session = Depends(get_session),
):
    logger.info(f"[marcar-leidos] Payload recibido: {payload}")
    
    contacto_id = payload.get("contacto_id")
    oportunidad_id = payload.get("oportunidad_id")
    contacto_referencia = payload.get("contacto_referencia")

    if not oportunidad_id and not contacto_id and not contacto_referencia:
        raise HTTPException(status_code=400, detail="Se requiere contacto_id, oportunidad_id o contacto_referencia")

    stmt = update(CRMMensaje).where(
        CRMMensaje.deleted_at.is_(None),
        CRMMensaje.tipo == TipoMensaje.ENTRADA.value,
        CRMMensaje.estado == EstadoMensaje.NUEVO.value,
    )

    if oportunidad_id:
        stmt = stmt.where(CRMMensaje.oportunidad_id == oportunidad_id)
    elif contacto_id:
        stmt = stmt.where(CRMMensaje.contacto_id == contacto_id)
    else:
        stmt = stmt.where(CRMMensaje.contacto_referencia == contacto_referencia)

    stmt = stmt.values(
        estado=EstadoMensaje.RECIBIDO.value,
        fecha_estado=datetime.utcnow(),
    )
    result = session.exec(stmt)
    session.commit()
    
    logger.info(f"[marcar-leidos] Mensajes actualizados: {result.rowcount}")

    return {"updated": result.rowcount or 0}


@router.get("/acciones/conversaciones")
def conversaciones_cursor(
    session: Session = Depends(get_session),
    canal: str | None = None,
    responsable_id: int | None = None,
    estado_oportunidad: str | None = None,
    cursor: str | None = None,
    limit: int = 30,
):
    """
    Devuelve conversaciones agrupadas por oportunidad/contacto con cursor.
    """
    limit = max(1, min(limit, 100))
    cutoff_activo = datetime.now(UTC) - timedelta(days=30)
    base_where = [
        CRMOportunidad.ultimo_mensaje_id.is_not(None),
        CRMOportunidad.ultimo_mensaje_at.is_not(None),
        CRMMensaje.deleted_at.is_(None),
        or_(
            CRMOportunidad.activo.is_(True),
            and_(
                CRMOportunidad.activo.is_(False),
                CRMOportunidad.fecha_estado >= cutoff_activo,
            ),
        ),
    ]
    if responsable_id is not None:
        base_where.append(CRMOportunidad.responsable_id == responsable_id)
        base_where.append(CRMOportunidad.activo.is_(True))

    if estado_oportunidad:
        base_where.append(CRMOportunidad.estado == estado_oportunidad)

    if canal:
        base_where.append(CRMMensaje.canal == canal)

    unread_count_subq = (
        select(func.count())
        .select_from(CRMMensaje)
        .where(
            CRMMensaje.deleted_at.is_(None),
            CRMMensaje.tipo == TipoMensaje.ENTRADA.value,
            CRMMensaje.estado == EstadoMensaje.NUEVO.value,
            CRMMensaje.oportunidad_id == CRMOportunidad.id,
        )
        .correlate(CRMOportunidad)
        .scalar_subquery()
    )

    base_stmt = (
        select(
            CRMOportunidad,
            CRMMensaje,
            CRMContacto,
            CRMTipoOperacion.nombre.label("tipo_operacion_nombre"),
            CRMTipoOperacion.codigo.label("tipo_operacion_codigo"),
            unread_count_subq.label("unread_count"),
        )
        .join(CRMMensaje, CRMOportunidad.ultimo_mensaje_id == CRMMensaje.id)
        .join(CRMContacto, CRMMensaje.contacto_id == CRMContacto.id, isouter=True)
        .join(CRMTipoOperacion, CRMOportunidad.tipo_operacion_id == CRMTipoOperacion.id, isouter=True)
        .where(*base_where)
    )

    if cursor:
        parsed = _parse_cursor(cursor)
        if parsed:
            cursor_time, cursor_id = parsed
            base_stmt = base_stmt.where(
                or_(
                    CRMOportunidad.ultimo_mensaje_at < cursor_time,
                    and_(
                        CRMOportunidad.ultimo_mensaje_at == cursor_time,
                        CRMOportunidad.ultimo_mensaje_id < cursor_id,
                    ),
                )
            )

    ordered_rows = session.exec(
        base_stmt.order_by(
            CRMOportunidad.ultimo_mensaje_at.desc(),
            CRMOportunidad.ultimo_mensaje_id.desc(),
        ).limit(limit + 1)
    ).all()
    if not ordered_rows:
        return {"data": [], "next_cursor": None, "has_more": False}

    has_more = len(ordered_rows) > limit
    if has_more:
        ordered_rows = ordered_rows[:limit]

    last_row = ordered_rows[-1]
    next_cursor = None
    if has_more:
        last_opp = last_row[0]
        if last_opp.ultimo_mensaje_at and last_opp.ultimo_mensaje_id:
            next_cursor = f"{serialize_datetime(last_opp.ultimo_mensaje_at)}|{last_opp.ultimo_mensaje_id}"

    conversations: list[dict[str, Any]] = []
    for opp, msg, contacto, tipo_nombre, tipo_codigo, unread_count in ordered_rows:
        oportunidad_titulo = (
            opp.titulo or opp.descripcion_estado or opp.descripcion
        )
        contacto_nombre = None
        if contacto:
            contacto_nombre = contacto.nombre_completo or contacto.nombre
        conversations.append({
            "id": f"op-{opp.id}",
            "contacto_id": msg.contacto_id,
            "oportunidad_id": opp.id,
            "oportunidad_titulo": oportunidad_titulo,
            "oportunidad_estado": opp.estado,
            "oportunidad_activo": opp.activo,
            "oportunidad_tipo_operacion_nombre": tipo_nombre,
            "oportunidad_tipo_operacion_codigo": tipo_codigo,
            "contacto_referencia": msg.contacto_referencia,
            "contacto_nombre": contacto_nombre,
            "ultimo_mensaje": filtrar_respuesta(msg),
            "fecha": serialize_datetime(msg.fecha_mensaje or msg.created_at) if (msg.fecha_mensaje or msg.created_at) else None,
            "unread_count": int(unread_count or 0),
        })

    return {
        "data": conversations,
        "next_cursor": next_cursor,
        "has_more": has_more,
    }
