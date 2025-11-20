from .crm_catalogos_router import (
    crm_tipo_operacion_router,
    crm_motivo_perdida_router,
    crm_condicion_pago_router,
    crm_tipo_evento_router,
    crm_motivo_evento_router,
    crm_origen_lead_router,
    moneda_router,
    crm_moneda_router,
    cotizacion_moneda_router,
    cotizacion_conversion_router,
)
from .crm_contacto_router import crm_contacto_router
from .crm_oportunidad_router import crm_oportunidad_router
from .crm_evento_router import crm_evento_router

__all__ = [
    "crm_tipo_operacion_router",
    "crm_motivo_perdida_router",
    "crm_condicion_pago_router",
    "crm_tipo_evento_router",
    "crm_motivo_evento_router",
    "crm_origen_lead_router",
    "moneda_router",
    "crm_moneda_router",
    "cotizacion_moneda_router",
    "cotizacion_conversion_router",
    "crm_contacto_router",
    "crm_oportunidad_router",
    "crm_evento_router",
]
