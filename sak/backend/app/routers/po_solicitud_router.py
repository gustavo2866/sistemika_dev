from app.models.compras import PoSolicitud, PoSolicitudDetalle
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router

# CRUD con relación anidada para detalles de solicitud de compra
po_solicitud_crud = NestedCRUD(
    PoSolicitud,
    nested_relations={
        "detalles": {
            "model": PoSolicitudDetalle,
            "fk_field": "solicitud_id",
            "allow_delete": True,
        }
    },
)

# Router genérico para solicitudes de compra (PO)
po_solicitud_router = create_generic_router(
    model=PoSolicitud,
    crud=po_solicitud_crud,
    prefix="/po-solicitudes",
    tags=["po-solicitudes"],
)