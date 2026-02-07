"""
Router para Po Solicitud Detalles - endpoints básicos para referencias en frontend
"""
from app.core.router import create_generic_router
from app.core.generic_crud import GenericCRUD
from app.models.compras import PoSolicitudDetalle

# CRUD básico para detalles de solicitud (para referencias en frontend)
po_solicitud_detalle_crud = GenericCRUD(PoSolicitudDetalle)

# Router básico para permitir queries de referencia desde frontend
po_solicitud_detalle_router = create_generic_router(
    model=PoSolicitudDetalle,
    crud=po_solicitud_detalle_crud,
    prefix="/po-solicitud-detalles",
    tags=["po-solicitud-detalles"],
)