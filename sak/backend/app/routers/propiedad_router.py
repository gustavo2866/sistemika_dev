from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from app.models.propiedad import Propiedad
from app.models.vacancia import Vacancia
from app.models.enums import EstadoPropiedad, TRANSICIONES_ESTADO_PROPIEDAD
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router
from app.db import get_session

propiedad_crud = GenericCRUD(Propiedad)
vacancia_crud = GenericCRUD(Vacancia)

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
    - El nuevo estado debe ser válido según TRANSICIONES_ESTADO_PROPIEDAD
    - Si la propiedad tiene ciclo activo, actualiza el ciclo
    - Si no tiene ciclo activo y pasa a estado 1-recibida, crea nuevo ciclo
    """
    # 1. Obtener propiedad usando CRUD
    propiedad = propiedad_crud.get(session, id)
    if not propiedad:
        raise HTTPException(status_code=404, detail="Propiedad no encontrada")
    
    estado_actual = propiedad.estado
    nuevo_estado = data.nuevo_estado
    
    # 2. Validar transición de estado
    estados_validos = TRANSICIONES_ESTADO_PROPIEDAD.get(estado_actual, [])
    if nuevo_estado not in estados_validos:
        raise HTTPException(
            status_code=400,
            detail=f"Transición inválida de '{estado_actual}' a '{nuevo_estado}'. Estados válidos: {', '.join(estados_validos)}"
        )
    
    # 3. Obtener vacancia activa (si existe) usando CRUD
    from sqlmodel import select
    statement = select(Vacancia).where(
        Vacancia.propiedad_id == id,
        Vacancia.ciclo_activo == True,
        Vacancia.deleted_at.is_(None)
    )
    vacancias = session.exec(statement).all()
    vacancia_activa = vacancias[0] if vacancias else None
    
    # 4. Actualizar propiedad
    propiedad_data = {
        "estado": nuevo_estado,
        "estado_fecha": datetime.utcnow(),
        "estado_comentario": data.comentario
    }
    propiedad = propiedad_crud.update(session, id, propiedad_data)
    
    # 5. Actualizar o crear vacancia
    if nuevo_estado == EstadoPropiedad.RECIBIDA.value:
        # Si viene de ALQUILADA, crear nuevo ciclo
        if estado_actual == EstadoPropiedad.ALQUILADA.value:
            if vacancia_activa:
                # Cerrar ciclo anterior
                vacancia_crud.update(session, vacancia_activa.id, {
                    "ciclo_activo": False,
                    "dias_totales": vacancia_activa.dias_totales_calculado
                })
            # Crear nuevo ciclo usando CRUD
            nueva_vacancia_data = {
                "propiedad_id": id,
                "ciclo_activo": True,
                "fecha_recibida": datetime.utcnow(),
                "comentario_recibida": data.comentario
            }
            vacancia_crud.create(session, nueva_vacancia_data)
    
    elif nuevo_estado == EstadoPropiedad.EN_REPARACION.value:
        if vacancia_activa:
            vacancia_crud.update(session, vacancia_activa.id, {
                "fecha_en_reparacion": datetime.utcnow(),
                "comentario_en_reparacion": data.comentario
            })
    
    elif nuevo_estado == EstadoPropiedad.DISPONIBLE.value:
        if vacancia_activa:
            update_data = {
                "fecha_disponible": datetime.utcnow(),
                "comentario_disponible": data.comentario
            }
            # Calcular y guardar dias_reparacion si corresponde
            if vacancia_activa.fecha_en_reparacion:
                update_data["dias_reparacion"] = vacancia_activa.dias_reparacion_calculado
            vacancia_crud.update(session, vacancia_activa.id, update_data)
    
    elif nuevo_estado == EstadoPropiedad.ALQUILADA.value:
        if vacancia_activa:
            # Cerrar ciclo
            update_data = {
                "fecha_alquilada": datetime.utcnow(),
                "comentario_alquilada": data.comentario,
                "ciclo_activo": False,
                "dias_disponible": vacancia_activa.dias_disponible_calculado,
                "dias_totales": vacancia_activa.dias_totales_calculado
            }
            # Guardar dias_reparacion si existe
            if vacancia_activa.fecha_en_reparacion:
                update_data["dias_reparacion"] = vacancia_activa.dias_reparacion_calculado
            vacancia_crud.update(session, vacancia_activa.id, update_data)
    
    elif nuevo_estado == EstadoPropiedad.RETIRADA.value:
        if vacancia_activa:
            # Cerrar ciclo sin alquilar
            update_data = {
                "fecha_retirada": datetime.utcnow(),
                "comentario_retirada": data.comentario,
                "ciclo_activo": False
            }
            # Guardar métricas parciales
            if vacancia_activa.fecha_en_reparacion:
                update_data["dias_reparacion"] = vacancia_activa.dias_reparacion_calculado
            if vacancia_activa.fecha_disponible:
                update_data["dias_disponible"] = vacancia_activa.dias_disponible_calculado
            update_data["dias_totales"] = vacancia_activa.dias_totales_calculado
            vacancia_crud.update(session, vacancia_activa.id, update_data)
    
    return {
        "success": True,
        "message": f"Estado cambiado de '{estado_actual}' a '{nuevo_estado}'",
        "propiedad_id": id,
        "nuevo_estado": nuevo_estado
    }
