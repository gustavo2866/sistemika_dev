from app.models.solicitud import Solicitud
from app.models.solicitud_detalle import SolicitudDetalle
from app.core.nested_crud import NestedCRUD
from app.core.router import create_generic_router

solicitud_crud = NestedCRUD(
    Solicitud,
    nested_relations={
        "detalles": {
            "model": SolicitudDetalle,
            "fk_field": "solicitud_id",
            "allow_delete": True,
        }
    },
)

solicitud_router = create_generic_router(
    model=Solicitud,
    crud=solicitud_crud,
    prefix="/solicitudes",
    tags=["solicitudes"],
)
