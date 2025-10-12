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
    "proyecto_router"
]
