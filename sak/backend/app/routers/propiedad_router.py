from datetime import date
from typing import Optional
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel, field_validator

from app.models.propiedad import Propiedad
from app.models.vacancia import Vacancia
from app.models.enums import EstadoPropiedad, TRANSICIONES_ESTADO_PROPIEDAD
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session

propiedad_crud = GenericCRUD(Propiedad)
vacancia_crud = GenericCRUD(Vacancia)
logger = logging.getLogger(__name__)

propiedad_router = create_generic_router(
    model=Propiedad,
    crud=propiedad_crud,
    prefix="/propiedades",
    tags=["propiedades"],
)


class CambiarEstadoRequest(BaseModel):
    """Request para cambiar el estado de una propiedad."""
    nuevo_estado: str
    comentario: Optional[str] = None
    fecha: Optional[date] = None  # Si no se provee, usa fecha actual
    
    @field_validator('fecha', mode='before')
    @classmethod
    def parse_fecha(cls, v):
        if v is None:
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            # Intentar parsear string como fecha (YYYY-MM-DD o ISO con hora)
            try:
                return date.fromisoformat(v.split("T")[0])
            except ValueError:
                raise ValueError('Formato de fecha invalido')
        return v


@propiedad_router.post("/{id}/cambiar-estado", response_model=dict)
def cambiar_estado_propiedad(
    id: int,
    data: CambiarEstadoRequest,
    session: Session = Depends(get_session)
):
    """
    Cambia el estado de una propiedad y actualiza su ciclo de vacancia.
    
    Validaciones:
    - La propiedad debe existir
    - El nuevo estado debe ser válido segun TRANSICIONES_ESTADO_PROPIEDAD
    - La fecha no puede ser anterior a la del estado anterior
    - Si la propiedad tiene ciclo activo, actualiza el ciclo
    - Si no tiene ciclo activo y pasa a estado 1-recibida, crea nuevo ciclo
    """
    try:
        logger.info("cambiar_estado_propiedad request", extra={
            "propiedad_id": id,
            "nuevo_estado": data.nuevo_estado,
            "comentario": data.comentario,
            "fecha_raw": data.fecha.isoformat() if data.fecha else None,
        })

        # 1. Obtener propiedad usando CRUD
        propiedad = propiedad_crud.get(session, id)
        if not propiedad:
            raise HTTPException(status_code=404, detail="Propiedad no encontrada")
        
        estado_actual = propiedad.estado
        nuevo_estado = data.nuevo_estado
        fecha_cambio = data.fecha or date.today()
        
        # 2. Validar transición de estado
        estados_validos = TRANSICIONES_ESTADO_PROPIEDAD.get(estado_actual, [])
        if nuevo_estado not in estados_validos:
            raise HTTPException(
                status_code=400,
                detail=f"Transición inválida de '{estado_actual}' a '{nuevo_estado}'. Estados válidos: {', '.join(estados_validos)}"
            )
        
        # 3. Obtener vacancia activa (si existe) usando CRUD
        statement = select(Vacancia).where(
            Vacancia.propiedad_id == id,
            Vacancia.ciclo_activo == True,
            Vacancia.deleted_at.is_(None)
        )
        vacancias = session.exec(statement).all()
        vacancia_activa = vacancias[0] if vacancias else None
        
        # 4. Validar que la fecha no sea anterior a la del estado anterior
        if vacancia_activa:
            fecha_anterior = None
            if estado_actual == EstadoPropiedad.RECIBIDA.value:
                fecha_anterior = vacancia_activa.fecha_recibida
            elif estado_actual == EstadoPropiedad.EN_REPARACION.value:
                fecha_anterior = vacancia_activa.fecha_en_reparacion
            elif estado_actual == EstadoPropiedad.DISPONIBLE.value:
                fecha_anterior = vacancia_activa.fecha_disponible
            elif estado_actual == EstadoPropiedad.ALQUILADA.value:
                fecha_anterior = vacancia_activa.fecha_alquilada
            
            if fecha_anterior and fecha_cambio < fecha_anterior:
                raise HTTPException(
                    status_code=400,
                    detail=f"La fecha no puede ser anterior a la fecha del estado '{estado_actual}' ({fecha_anterior.isoformat()})"
                )
        
        # También validar contra estado_fecha de la propiedad
        if propiedad.estado_fecha and fecha_cambio < propiedad.estado_fecha:
            raise HTTPException(
                status_code=400,
                detail=f"La fecha no puede ser anterior a la fecha del estado actual de la propiedad ({propiedad.estado_fecha.isoformat()})"
            )
        
        # 5. Actualizar propiedad
        propiedad_data = {
            "estado": nuevo_estado,
            "estado_fecha": fecha_cambio,
            "estado_comentario": data.comentario
        }
        propiedad = propiedad_crud.update(session, id, propiedad_data)
        
        # 6. Actualizar o crear vacancia
        if nuevo_estado == EstadoPropiedad.RECIBIDA.value:
            # Si viene de ALQUILADA, crear nuevo ciclo
            if estado_actual == EstadoPropiedad.ALQUILADA.value:
                if vacancia_activa:
                    update_data = {"ciclo_activo": False}
                    if vacancia_activa.fecha_recibida and fecha_cambio >= vacancia_activa.fecha_recibida:
                        update_data["dias_totales"] = (fecha_cambio - vacancia_activa.fecha_recibida).days
                    vacancia_crud.update(session, vacancia_activa.id, update_data)
                nueva_vacancia_data = {
                    "propiedad_id": id,
                    "ciclo_activo": True,
                    "fecha_recibida": fecha_cambio,
                    "comentario_recibida": data.comentario
                }
                vacancia_crud.create(session, nueva_vacancia_data)
        
        elif nuevo_estado == EstadoPropiedad.EN_REPARACION.value:
            if vacancia_activa:
                vacancia_crud.update(session, vacancia_activa.id, {
                    "fecha_en_reparacion": fecha_cambio,
                    "comentario_en_reparacion": data.comentario
                })
        
        elif nuevo_estado == EstadoPropiedad.DISPONIBLE.value:
            if vacancia_activa:
                update_data = {
                    "fecha_disponible": fecha_cambio,
                    "comentario_disponible": data.comentario
                }
                if vacancia_activa.fecha_en_reparacion and fecha_cambio >= vacancia_activa.fecha_en_reparacion:
                    update_data["dias_reparacion"] = (fecha_cambio - vacancia_activa.fecha_en_reparacion).days
                vacancia_crud.update(session, vacancia_activa.id, update_data)
        
        elif nuevo_estado == EstadoPropiedad.ALQUILADA.value:
            if vacancia_activa:
                update_data = {
                    "fecha_alquilada": fecha_cambio,
                    "comentario_alquilada": data.comentario,
                    "ciclo_activo": False
                }
                vacancia_crud.update(session, vacancia_activa.id, update_data)
                
                session.refresh(vacancia_activa)
                
                dias_disponible = None
                dias_reparacion = None
                dias_totales = None
                
                if vacancia_activa.fecha_disponible and fecha_cambio >= vacancia_activa.fecha_disponible:
                    dias_disponible = (fecha_cambio - vacancia_activa.fecha_disponible).days
                
                if vacancia_activa.fecha_en_reparacion and vacancia_activa.fecha_disponible:
                    if vacancia_activa.fecha_disponible >= vacancia_activa.fecha_en_reparacion:
                        dias_reparacion = (vacancia_activa.fecha_disponible - vacancia_activa.fecha_en_reparacion).days
                
                if vacancia_activa.fecha_recibida and fecha_cambio >= vacancia_activa.fecha_recibida:
                    dias_totales = (fecha_cambio - vacancia_activa.fecha_recibida).days
                
                vacancia_crud.update(session, vacancia_activa.id, {
                    "dias_disponible": dias_disponible,
                    "dias_reparacion": dias_reparacion,
                    "dias_totales": dias_totales
                })
        
        elif nuevo_estado == EstadoPropiedad.RETIRADA.value:
            if vacancia_activa:
                update_data = {
                    "fecha_retirada": fecha_cambio,
                    "comentario_retirada": data.comentario,
                    "ciclo_activo": False
                }
                if vacancia_activa.fecha_en_reparacion:
                    update_data["dias_reparacion"] = vacancia_activa.dias_reparacion_calculado
                if vacancia_activa.fecha_disponible:
                    update_data["dias_disponible"] = vacancia_activa.dias_disponible_calculado
                update_data["dias_totales"] = vacancia_activa.dias_totales_calculado
                vacancia_crud.update(session, vacancia_activa.id, update_data)
        
        logger.info("cambiar_estado_propiedad success", extra={
            "propiedad_id": id,
            "nuevo_estado": nuevo_estado,
            "estado_anterior": estado_actual,
        })

        return {
            "success": True,
            "message": f"Estado cambiado de '{estado_actual}' a '{nuevo_estado}'",
            "propiedad_id": id,
            "nuevo_estado": nuevo_estado
        }
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        logger.exception("cambiar_estado_propiedad failed", extra={
            "propiedad_id": id,
            "nuevo_estado": getattr(data, 'nuevo_estado', None),
        })
        raise HTTPException(status_code=500, detail="Error interno al cambiar estado de la propiedad") from exc

