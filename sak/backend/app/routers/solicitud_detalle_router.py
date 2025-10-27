from app.models.solicitud_detalle import SolicitudDetalle
from app.core.generic_crud import GenericCRUD
from app.core.router import create_generic_router

solicitud_detalle_crud = GenericCRUD(SolicitudDetalle)

# comentario 12
solicitud_detalle_router = create_generic_router(
    model=SolicitudDetalle,
    crud=solicitud_detalle_crud,
    prefix="/solicitud-detalles",
    tags=["solicitud-detalles"],
)
