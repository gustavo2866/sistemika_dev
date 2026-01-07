from decimal import Decimal
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.core.router import create_generic_router
from app.db import get_session
from app.models import (
    CRMTipoOperacion,
    CRMMotivoPerdida,
    CRMCondicionPago,
    CRMTipoEvento,
    CRMMotivoEvento,
    Moneda,
    CotizacionMoneda,
    CRMCatalogoRespuesta,
)
from app.crud.crm_tipo_operacion_crud import crm_tipo_operacion_crud
from app.crud.crm_motivo_perdida_crud import crm_motivo_perdida_crud
from app.crud.crm_condicion_pago_crud import crm_condicion_pago_crud
from app.crud.crm_tipo_evento_crud import crm_tipo_evento_crud
from app.crud.crm_motivo_evento_crud import crm_motivo_evento_crud
from app.crud.moneda_crud import moneda_crud
from app.crud.cotizacion_moneda_crud import cotizacion_moneda_crud
from app.crud.crm_catalogo_respuesta_crud import crm_catalogo_respuesta_crud
from app.services.cotizacion_service import cotizacion_service


crm_tipo_operacion_router = create_generic_router(
    model=CRMTipoOperacion,
    crud=crm_tipo_operacion_crud,
    prefix="/crm/catalogos/tipos-operacion",
    tags=["crm-catalogos"],
)

crm_motivo_perdida_router = create_generic_router(
    model=CRMMotivoPerdida,
    crud=crm_motivo_perdida_crud,
    prefix="/crm/catalogos/motivos-perdida",
    tags=["crm-catalogos"],
)

crm_condicion_pago_router = create_generic_router(
    model=CRMCondicionPago,
    crud=crm_condicion_pago_crud,
    prefix="/crm/catalogos/condiciones-pago",
    tags=["crm-catalogos"],
)

crm_tipo_evento_router = create_generic_router(
    model=CRMTipoEvento,
    crud=crm_tipo_evento_crud,
    prefix="/crm/catalogos/tipos-evento",
    tags=["crm-catalogos"],
)

crm_motivo_evento_router = create_generic_router(
    model=CRMMotivoEvento,
    crud=crm_motivo_evento_crud,
    prefix="/crm/catalogos/motivos-evento",
    tags=["crm-catalogos"],
)

crm_catalogo_respuesta_router = create_generic_router(
    model=CRMCatalogoRespuesta,
    crud=crm_catalogo_respuesta_crud,
    prefix="/crm/catalogos/respuestas",
    tags=["crm-catalogos"],
)



moneda_router = create_generic_router(
    model=Moneda,
    crud=moneda_crud,
    prefix="/monedas",
    tags=["monedas"],
)

crm_moneda_router = create_generic_router(
    model=Moneda,
    crud=moneda_crud,
    prefix="/crm/catalogos/monedas",
    tags=["crm-catalogos"],
)

cotizacion_moneda_router = create_generic_router(
    model=CotizacionMoneda,
    crud=cotizacion_moneda_crud,
    prefix="/crm/cotizaciones",
    tags=["crm-cotizaciones"],
)

cotizacion_conversion_router = APIRouter(
    prefix="/crm/cotizaciones",
    tags=["crm-cotizaciones"],
)


@cotizacion_conversion_router.get("/convertir")
def convertir(
    monto: Decimal = Query(..., description="Monto a convertir"),
    moneda_origen: str = Query(..., description="Código de moneda origen"),
    moneda_destino: str = Query(..., description="Código de moneda destino"),
    fecha: date = Query(default=date.today(), description="Fecha de referencia"),
    session: Session = Depends(get_session),
):
    origen = cotizacion_service.obtener_moneda(session, moneda_origen)
    destino = cotizacion_service.obtener_moneda(session, moneda_destino)
    if not origen or not destino:
        raise HTTPException(status_code=404, detail="Moneda no encontrada")

    monto_convertido = cotizacion_service.convertir(
        session=session,
        monto=monto,
        moneda_origen_id=origen.id,
        moneda_destino_id=destino.id,
        fecha=fecha,
    )
    if monto_convertido is None:
        raise HTTPException(status_code=404, detail="No hay cotización disponible")

    return {
        "monto_original": float(monto),
        "moneda_origen": moneda_origen,
        "monto_convertido": float(monto_convertido),
        "moneda_destino": moneda_destino,
        "fecha_aplicada": fecha.isoformat(),
    }
