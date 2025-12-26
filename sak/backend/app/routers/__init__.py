# routers package
from .item_router import item_router
from .user_router import user_router
from .pais_router import pais_router
from .tarea_router import tarea_router
from .proveedor_router import proveedor_router
from .tipo_operacion_router import tipo_operacion_router
from .factura_router import factura_router
from .factura_detalle_router import factura_detalle_router
from .factura_impuesto_router import factura_impuesto_router
from .solicitud_router import solicitud_router
from .solicitud_detalle_router import solicitud_detalle_router
from .proyecto_router import proyecto_router
from .nomina_router import nomina_router
from .partediario_router import parte_diario_router
from .crm import (
    crm_tipo_operacion_router,
    crm_motivo_perdida_router,
    crm_condicion_pago_router,
    crm_tipo_evento_router,
    crm_motivo_evento_router,
    moneda_router,
    crm_moneda_router,
    cotizacion_moneda_router,
    cotizacion_conversion_router,
    crm_contacto_router,
    crm_evento_router,
)
from .emprendimiento_router import emprendimiento_router

__all__ = [
    "item_router",
    "user_router", 
    "pais_router",
    "tarea_router",
    "proveedor_router",
    "tipo_operacion_router",
    "factura_router",
    "factura_detalle_router",
    "factura_impuesto_router",
    "solicitud_router",
    "solicitud_detalle_router",
    "proyecto_router",
    "nomina_router",
    "parte_diario_router",
    "crm_tipo_operacion_router",
    "crm_motivo_perdida_router",
    "crm_condicion_pago_router",
    "crm_tipo_evento_router",
    "crm_motivo_evento_router",
    "moneda_router",
    "crm_moneda_router",
    "cotizacion_moneda_router",
    "cotizacion_conversion_router",
    "crm_contacto_router",
    "crm_evento_router",
    "emprendimiento_router",
]
